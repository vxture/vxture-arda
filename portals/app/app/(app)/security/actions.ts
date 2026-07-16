"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { canUseFeature } from "../../entitlement/capability";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { prisma } from "../../lib/db";
import type { AssetLevel } from "../dashboard/seed";

export type PolicyActionResult = { ok: true } | { ok: false; error: "unauthenticated" | "forbidden" | "tier" | "invalid" };

const ASSET_LEVELS: readonly AssetLevel[] = ["public", "internal", "sensitive", "core"];
const STRATEGIES = new Set(["redact", "hash", "partial"]);
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Set the workspace's max external classification level (Sec-BL2). Upserts
 *  the single enabled access-type Policy row - resolveEgressPolicy() takes the
 *  last valid maxExternalLevel across enabled access policies, so keeping
 *  exactly one keeps resolution deterministic. */
export async function setMaxExternalLevel(level: string): Promise<PolicyActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.governance.policies")) return { ok: false, error: "tier" };

  if (!ASSET_LEVELS.includes(level as AssetLevel)) return { ok: false, error: "invalid" };

  const existing = await prisma.policy.findFirst({
    where: { workspaceId: session.workspaceId, type: "access", enabled: true },
  });

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.policy.update({ where: { id: existing.id }, data: { config: { maxExternalLevel: level } } });
    } else {
      await tx.policy.create({
        data: {
          workspaceId: session.workspaceId,
          name: "External access level",
          type: "access",
          scope: "workspace",
          config: { maxExternalLevel: level },
        },
      });
    }
    await tx.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "security.policy.access.set",
        target: existing?.id ?? "access-policy",
        metadata: { maxExternalLevel: level },
      },
    });
  });

  revalidatePath("/security");
  return { ok: true };
}

export interface MaskingRuleInput {
  datasetId: string | null;
  fields: string[];
  strategy: string;
}

/** Add a masking rule (Sec-BL1). datasetId null applies workspace-wide. */
export async function createMaskingRule(input: MaskingRuleInput): Promise<PolicyActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.governance.policies")) return { ok: false, error: "tier" };

  const fields = input.fields.map((f) => f.trim()).filter((f) => IDENT.test(f));
  if (fields.length === 0 || !STRATEGIES.has(input.strategy)) return { ok: false, error: "invalid" };

  let datasetName: string | null = null;
  if (input.datasetId) {
    const dataset = await prisma.dataset.findFirst({ where: { workspaceId: session.workspaceId, id: input.datasetId } });
    if (!dataset) return { ok: false, error: "invalid" };
    datasetName = dataset.name;
  }

  await prisma.$transaction(async (tx) => {
    const policy = await tx.policy.create({
      data: {
        workspaceId: session.workspaceId,
        name: datasetName ? `Mask ${datasetName}` : "Mask (workspace-wide)",
        type: "masking",
        scope: input.datasetId ? "dataset" : "workspace",
        config: { datasetId: input.datasetId, fields, strategy: input.strategy },
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "security.policy.masking.create",
        target: policy.id,
        metadata: { dataset: datasetName ?? "*", fields, strategy: input.strategy },
      },
    });
  });

  revalidatePath("/security");
  return { ok: true };
}

/** Remove a masking rule. */
export async function deleteMaskingRule(id: string): Promise<PolicyActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.governance.policies")) return { ok: false, error: "tier" };

  const policy = await prisma.policy.findFirst({ where: { workspaceId: session.workspaceId, id, type: "masking" } });
  if (!policy) return { ok: false, error: "invalid" };

  await prisma.$transaction([
    prisma.policy.delete({ where: { id: policy.id } }),
    prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "security.policy.masking.delete",
        target: policy.id,
        metadata: { name: policy.name },
      },
    }),
  ]);

  revalidatePath("/security");
  return { ok: true };
}
