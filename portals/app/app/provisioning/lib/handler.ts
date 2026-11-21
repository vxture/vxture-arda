/** Atomic lifecycle, delivery dedup and versionless notifications. */
import type { Prisma, PrismaClient } from "../../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { writeAudit } from "../../lib/audit";
import type { ProvisioningPayload } from "./payload";
export type { ProvisioningPayload } from "./payload";
export type HandleResult =
  | { outcome: "processed" } | { outcome: "duplicate" }
  | { outcome: "stale"; existingSeq: number } | { outcome: "ignored"; reason: string };

export async function lockWorkspace(tx: Prisma.TransactionClient, workspaceId: string): Promise<void> {
  // Works before the first watermark exists; shared by webhook/reconciliation.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`arda:provision:${workspaceId}`}, 0))`;
}
export async function applyLifecycle(tx: Prisma.TransactionClient, input: {
  workspaceId: string; tenantId: string; state: "provisioned" | "deprovisioned";
  seq: number; plan?: string | null;
}): Promise<HandleResult> {
  const { workspaceId, tenantId, seq, state, plan } = input;
  const key = { workspaceId_productCode: { workspaceId, productCode: "arda" } };
  const watermark = await tx.provisionSeq.findUnique({ where: key });
  if (watermark && seq <= watermark.lastSeq) return { outcome: "stale", existingSeq: watermark.lastSeq };
  const ref = await tx.workspaceRef.findUnique({ where: { id: workspaceId } });
  if (ref && ref.orgId !== tenantId) throw new Error("provisioning_tenant_conflict");
  if (state === "provisioned") {
    await tx.workspaceRef.upsert({ where: { id: workspaceId },
      create: { id: workspaceId, orgId: tenantId, tenantId, plan, status: state },
      update: { tenantId, plan: plan ?? undefined, status: state, wipedAt: null } });
  } else {
    // Stop before create still leaves an anchor. Never restart retention on retry.
    await tx.workspaceRef.upsert({ where: { id: workspaceId },
      create: { id: workspaceId, orgId: tenantId, tenantId, status: state, wipedAt: new Date() },
      update: { status: state, wipedAt: ref?.wipedAt ?? new Date() } });
    await writeAudit(tx, { workspaceId, actor: "platform", action: "workspace.wipe",
      target: workspaceId, metadata: { source: "tenant.deprovisioned", seq } });
  }
  await tx.provisionSeq.upsert({ where: key,
    create: { workspaceId, productCode: "arda", lastSeq: seq }, update: { lastSeq: seq } });
  return { outcome: "processed" };
}
export async function handleProvisioningEvent(payload: ProvisioningPayload,
  db: PrismaClient = prisma): Promise<HandleResult> {
  if ("plan" in payload && payload.plan?.startsWith("arda-beta-")) {
    return { outcome: "ignored", reason: "beta plan; lazily built" };
  }
  const result = await db.$transaction(async (tx): Promise<HandleResult> => {
    await lockWorkspace(tx, payload.workspace_id);
    const existing = await tx.webhookDelivery.findUnique({ where: { id: payload.id } });
    if (existing) {
      if (existing.workspaceId !== payload.workspace_id || existing.eventType !== payload.type
        || existing.tenantId !== payload.tenant_id || existing.seq !== (payload.seq ?? 0)) {
        throw new Error("provisioning_delivery_conflict");
      }
      return { outcome: "duplicate" };
    }
    let outcome: HandleResult = { outcome: "processed" };
    if (payload.type === "tenant.provisioned" || payload.type === "tenant.deprovisioned") {
      outcome = await applyLifecycle(tx, { workspaceId: payload.workspace_id,
        tenantId: payload.tenant_id, seq: payload.seq!, plan: payload.plan,
        state: payload.type === "tenant.provisioned" ? "provisioned" : "deprovisioned" });
    }
    await tx.webhookDelivery.create({ data: {
      id: payload.id, workspaceId: payload.workspace_id, tenantId: payload.tenant_id,
      eventType: payload.type,
      // Zero is a versionless ledger sentinel, never a lifecycle watermark.
      seq: payload.seq ?? 0, plan: "plan" in payload ? payload.plan : undefined,
    } });
    return outcome;
  }, { timeout: 15_000 });
  // Retry duplicates also evict in case the previous worker died after commit.
  getEntitlementResolver().invalidateCache(payload.workspace_id);
  return result;
}
