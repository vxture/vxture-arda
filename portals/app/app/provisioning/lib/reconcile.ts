import { z } from "zod";
import { prisma } from "../../lib/db";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { getProvisioningReadClient } from "../../platform/provisioning-read";
import { acknowledgeProvisioning } from "./ack";
import { applyLifecycle, lockWorkspace } from "./handler";
import { tryPublishWorkspaceRevision } from "../../events/outbox";

const identifier = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
export const reconciliationPage = z.object({
  items: z.array(z.object({ workspace_id: identifier, tenant_id: identifier,
    state: z.enum(["pending", "provisioned", "deprovisioned"]),
    seq: z.number().int().min(0).max(2_147_483_647),
    updated_at: z.string().datetime({ offset: true }),
  })).max(200),
  nextCursor: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/).nullable(),
});
type Item = z.infer<typeof reconciliationPage>["items"][number];

async function apply(item: Item): Promise<void> {
  if (item.state === "pending") return;
  const state = item.state;
  await prisma.$transaction(async tx => {
    await lockWorkspace(tx, item.workspace_id);
    await applyLifecycle(tx, { workspaceId: item.workspace_id, tenantId: item.tenant_id,
      seq: item.seq, state });
  }, { timeout: 15_000 });
  getEntitlementResolver().invalidateCache(item.workspace_id);
  await tryPublishWorkspaceRevision(item.workspace_id);
  if (state === "provisioned") await acknowledgeProvisioning(item.workspace_id, item.seq);
}

export async function reconcileProvisioning(deps?: {
  page: (cursor?: string) => Promise<unknown>; apply: (item: Item) => Promise<void>;
}): Promise<{ pages: number; scanned: number; failed: number }> {
  const client = deps ? undefined : getProvisioningReadClient();
  const source = deps ?? { page: (cursor?: string) => client!.page(cursor), apply };
  let cursor: string | undefined;
  let pages = 0, scanned = 0, failed = 0;
  const seen = new Set<string>();
  // Every round starts at the beginning. Missing rows never imply deletion.
  for (;;) {
    const value = reconciliationPage.parse(await source.page(cursor));
    for (const item of value.items) {
      if (item.state !== "pending") {
        try { await source.apply(item); } catch { failed++; }
      }
      scanned++;
    }
    pages++;
    if (value.nextCursor === null) return { pages, scanned, failed };
    if (pages >= 1000 || seen.has(value.nextCursor)) throw new Error("provisioning_cursor_loop");
    seen.add(value.nextCursor);
    cursor = value.nextCursor;
  }
}

let started = false;
export function startProvisioningReconciliation(): void {
  if (started) return;
  started = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      // The read API is product-wide, not environment-scoped. Beta may inspect
      // the contract but must never mirror/ACK production provisioning facts.
      const readOnly = process.env.DEPLOY_STAGE !== "production";
      const client = readOnly ? getProvisioningReadClient() : undefined;
      const result = await reconcileProvisioning(readOnly ? {
        page: cursor => client!.page(cursor), apply: async () => {},
      } : undefined);
      console.info("[provisioning/reconcile]", { ...result, readOnly });
    } catch { console.error("[provisioning/reconcile] unavailable; retry scheduled"); }
    finally { running = false; }
  };
  // An initial round after server startup, followed by a full scan every 5 min.
  setTimeout(() => { void tick(); }, 1_000).unref();
  setInterval(() => { void tick(); }, 300_000).unref();
}
