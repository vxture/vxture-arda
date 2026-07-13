"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { canUseFeature } from "../../entitlement/capability";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { prisma } from "../../lib/db";
import { seal } from "../../lib/seal";
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
