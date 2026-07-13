"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { canUseFeature } from "../../entitlement/capability";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { prisma } from "../../lib/db";
import { seal, unseal, type SealedSecret } from "../../lib/seal";
import { getConnector } from "./connectors";
import { datasetCode, planSync } from "./sync-core";
import { featureKeyForSourceType } from "./source-types";
import type { Prisma } from "../../../generated/prisma/client";

export interface RegisterSourceInput {
  name: string;
  type: string;
  /** Raw connection JSON string from the form; sealed before persistence. */
  connectionJson?: string;
}

export type RegisterSourceResult =
  | { ok: true; id: string }
  | { ok: false; error: "unauthenticated" | "forbidden" | "invalid" | "tier" | "quota" | "config" };

/**
 * Register a data source. All four gate layers re-checked server-side:
 * session -> admin role (connection strings are an attack surface, biz-410) ->
 * capability by source type (basic/premium split) -> datasource.max plan
 * limit (platform-delivered number, product-enforced at the action point,
 * ent-120 v2). Credentials are sealed (AES-256-GCM) before persistence and
 * the registration writes an AuditLog row.
 */
export async function registerDataSource(input: RegisterSourceInput): Promise<RegisterSourceResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const name = input.name?.trim();
  const featureKey = featureKeyForSourceType(input.type);
  if (!name || name.length > 120 || !featureKey) return { ok: false, error: "invalid" };

  const resolver = getEntitlementResolver();
  const [subscription, quota] = await Promise.all([
    resolver.resolve(session.ardaClaim, session.workspaceId),
    resolver.resolveQuota(session.workspaceId),
  ]);
  if (!canUseFeature(subscription, featureKey)) return { ok: false, error: "tier" };

  const max = quota.limits.datasourceMax;
  if (max !== null) {
    const count = await prisma.dataSource.count({ where: { workspaceId: session.workspaceId } });
    if (count >= max) return { ok: false, error: "quota" };
  }

  let sealedConfig: Prisma.InputJsonValue | undefined;
  const rawConfig = input.connectionJson?.trim();
  if (rawConfig) {
    try {
      sealedConfig = seal(JSON.parse(rawConfig)) as unknown as Prisma.InputJsonValue;
    } catch {
      return { ok: false, error: "config" };
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.dataSource.create({
      data: {
        workspaceId: session.workspaceId,
        name,
        type: input.type,
        connectionConfig: sealedConfig,
        status: "connected",
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "datasource.register",
        target: row.id,
        metadata: { name, type: input.type },
      },
    });
    return row;
  });

  revalidatePath("/sources");
  return { ok: true, id: created.id };
}

export type SyncSourceResult =
  | { ok: true; created: number; updated: number; skippedByQuota: number }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "tier"
        | "unsupported"
        | "no_config"
        | "connect";
      reason?: string;
    };

/**
 * Sync a data source (I-BL1 execution chain): test/connect -> introspect
 * metadata -> upsert Datasets. Same server-side gate stack as registration
 * (the action dials out with sealed credentials, so it stays admin-only).
 * Failures set status=disconnected and audit datasource.sync_fail (I-BL4);
 * successes stamp lastSyncedAt and audit counts, INCLUDING quota-skipped
 * discoveries (no silent caps).
 */
export async function syncDataSource(sourceId: string): Promise<SyncSourceResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const source = await prisma.dataSource.findFirst({
    where: { workspaceId: session.workspaceId, id: sourceId },
  });
  if (!source) return { ok: false, error: "not_found" };

  const featureKey = featureKeyForSourceType(source.type);
  const resolver = getEntitlementResolver();
  const [subscription, quota] = await Promise.all([
    resolver.resolve(session.ardaClaim, session.workspaceId),
    resolver.resolveQuota(session.workspaceId),
  ]);
  if (!featureKey || !canUseFeature(subscription, featureKey)) return { ok: false, error: "tier" };

  const connector = getConnector(source.type);
  if (!connector) return { ok: false, error: "unsupported" };
  if (!source.connectionConfig) return { ok: false, error: "no_config" };

  let discovered;
  try {
    const config = unseal(source.connectionConfig as unknown as SealedSecret);
    discovered = await connector.pullMetadata(config);
  } catch (err) {
    const reason = (err as { reason?: string })?.reason ?? "error";
    await prisma.$transaction([
      prisma.dataSource.update({ where: { id: source.id }, data: { status: "disconnected" } }),
      prisma.auditLog.create({
        data: {
          workspaceId: session.workspaceId,
          actor: session.sub,
          action: "datasource.sync_fail",
          target: source.id,
          metadata: { name: source.name, type: source.type, reason },
        },
      }),
    ]);
    revalidatePath("/sources");
    return { ok: false, error: "connect", reason };
  }

  const [existing, datasetsInWorkspace] = await Promise.all([
    prisma.dataset.findMany({
      where: { workspaceId: session.workspaceId, dataSourceId: source.id },
      select: { code: true },
    }),
    prisma.dataset.count({ where: { workspaceId: session.workspaceId } }),
  ]);

  const plan = planSync(
    discovered,
    new Set(existing.map((e) => e.code)),
    source.name,
    quota.limits.datasetMax,
    datasetsInWorkspace,
  );

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const d of plan.toCreate) {
      await tx.dataset.create({
        data: {
          workspaceId: session.workspaceId,
          dataSourceId: source.id,
          name: d.name,
          code: datasetCode(source.name, d.sourceLocalId),
          type: d.type,
          location: d.location,
          rowCountEst: d.rowCountEst,
          sizeBytes: d.sizeBytes,
        },
      });
    }
    for (const d of plan.toUpdate) {
      await tx.dataset.update({
        where: {
          workspaceId_code: {
            workspaceId: session.workspaceId,
            code: datasetCode(source.name, d.sourceLocalId),
          },
        },
        data: { type: d.type, location: d.location, rowCountEst: d.rowCountEst, sizeBytes: d.sizeBytes },
      });
    }
    await tx.dataSource.update({
      where: { id: source.id },
      data: { status: "connected", lastSyncedAt: now },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "datasource.sync",
        target: source.id,
        metadata: {
          name: source.name,
          discovered: discovered.length,
          created: plan.toCreate.length,
          updated: plan.toUpdate.length,
          skippedByQuota: plan.skippedByQuota,
        },
      },
    });
  });

  revalidatePath("/sources");
  revalidatePath("/catalog");
  return {
    ok: true,
    created: plan.toCreate.length,
    updated: plan.toUpdate.length,
    skippedByQuota: plan.skippedByQuota,
  };
}
