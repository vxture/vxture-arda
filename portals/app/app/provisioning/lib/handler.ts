/**
 * Provisioning webhook event handler.
 * Implements the five product-side obligations per handoff §2:
 *   1. Verify signature (caller responsibility, done before this module)
 *   2. Idempotent by event id
 *   3. Ignore stale events by seq (per workspaceId, monotonic)
 *   4. Event semantics by type (see switch below)
 *   5. Return 200 (caller)
 *
 * Handled event types:
 *   tenant.provisioned     -> upsert WorkspaceRef (status=provisioned)
 *   tenant.deprovisioned   -> mark WorkspaceRef status=deprovisioned
 *   subscription_changed   -> evict C2 entitlement cache for immediate re-fetch
 *   grant.invalidated      -> v1 noop (data sharing not yet built); stored for dedup
 *
 * Beta plans are IGNORED: beta workspaces are lazily built on first entry and do
 * not rely on provisioning (arda_000_definition v1 §5.1). Any event whose plan
 * is a beta plan (code prefix `arda-beta-`) is acked (200) without side effects.
 */

import { prisma } from "../../lib/db";
import { getEntitlementResolver } from "../../entitlement/resolver";

/** Beta plans (code prefix `arda-beta-`) are lazily built and not provisioned
 *  via webhook - ignore their events (arda_000_definition §5.1). */
const BETA_PLAN_PREFIX = "arda-beta-";

export interface ProvisioningPayload {
  id: string; // platform delivery uuid
  type: string; // tenant.provisioned | tenant.deprovisioned | subscription_changed
  occurred_at: string;
  seq: number;
  workspace_id: string;
  tenant_id: string;
  application: string;
  plan?: string;
  data?: Record<string, unknown>;
}

export type HandleResult =
  | { outcome: "processed" }
  | { outcome: "duplicate" }
  | { outcome: "stale"; existingSeq: number }
  | { outcome: "ignored"; reason: string };

export async function handleProvisioningEvent(
  payload: ProvisioningPayload,
): Promise<HandleResult> {
  const { id, type, seq, workspace_id, tenant_id, plan } = payload;

  // Step 0: ignore beta-plan events (beta workspaces are lazily built, not
  // provisioned via webhook - arda_000_definition §5.1). One guard, all types.
  if (plan && plan.startsWith(BETA_PLAN_PREFIX)) {
    return { outcome: "ignored", reason: `beta plan (${plan}); lazily built` };
  }

  // Step 2: idempotency check - has this delivery id already been processed?
  const existing = await prisma.provisioningEvent.findUnique({ where: { id } });
  if (existing) return { outcome: "duplicate" };

  // Step 3: seq check - ignore events older than the newest we have seen for this workspace
  const latestEvent = await prisma.provisioningEvent.findFirst({
    where: { workspaceId: workspace_id },
    orderBy: { seq: "desc" },
  });
  if (latestEvent && seq <= latestEvent.seq) {
    return { outcome: "stale", existingSeq: latestEvent.seq };
  }

  // Step 4: apply event semantics
  await prisma.$transaction(async (tx) => {
    if (type === "tenant.provisioned") {
      // Upsert WorkspaceRef: create if new, re-provision if previously deprovisioned
      await tx.workspaceRef.upsert({
        where: { id: workspace_id },
        create: {
          id: workspace_id,
          orgId: tenant_id,
          tenantId: tenant_id,
          plan: plan ?? null,
          status: "provisioned",
        },
        update: {
          tenantId: tenant_id,
          plan: plan ?? undefined,
          status: "provisioned",
        },
      });
    } else if (type === "tenant.deprovisioned") {
      // Mark deprovisioned; do NOT delete - retain for audit.
      await tx.workspaceRef.updateMany({
        where: { id: workspace_id, status: "provisioned" },
        data: { status: "deprovisioned" },
      });
    }
    // subscription_changed and grant.invalidated: no WorkspaceRef mutation needed.
    // Both are stored in ProvisioningEvent below for idempotency.

    await tx.provisioningEvent.create({
      data: { id, workspaceId: workspace_id, tenantId: tenant_id, eventType: type, seq, plan },
    });
  });

  // subscription_changed: evict C2 cache so next request re-fetches immediately.
  // (Without this, the old tier/quota is served for up to 45 s.)
  if (type === "subscription_changed") {
    getEntitlementResolver().invalidateCache(workspace_id);
  }

  // grant.invalidated: v1 noop - data sharing visible-set not yet implemented.
  // Stored above for dedup; no further action until sharing is built.

  return { outcome: "processed" };
}
