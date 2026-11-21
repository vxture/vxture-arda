/** Durable usage outbox. Exhausted retries stay unflushed for operator recovery. */
import { prisma } from "../../lib/db";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { platformRequest, workspacePlatformContext } from "../../platform/client";
import { flushBatch, type FlushResult } from "./outbox";

const FLUSH_BATCH = 50;
const MAX_ATTEMPTS = 5;

export async function flushUsage(): Promise<FlushResult> {
  if (!process.env.PLATFORM_API_URL) {
    if (process.env.NODE_ENV === "production") throw new Error("platform_api_unconfigured");
    return { processed: 0, succeeded: 0, gated: 0, failed: 0, exhausted: 0 };
  }
  const rows = await prisma.usageRaw.findMany({
    where: { flushed: false, flushAttempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" }, take: FLUSH_BATCH,
  });
  const result = await flushBatch(rows, {
    report: async row => platformRequest("/usage/consume", await workspacePlatformContext(row.workspaceId), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspace_id: row.workspaceId, product: row.product,
        metric: row.metric, amount: row.amount, idempotency_key: row.idempotencyKey, intent: "report" }),
    }),
    save: (id, data) => prisma.usageRaw.update({ where: { id }, data }),
    invalidate: workspaceId => getEntitlementResolver().invalidateCache(workspaceId),
  });
  result.exhausted = await prisma.usageRaw.count({
    where: { flushed: false, flushAttempts: { gte: MAX_ATTEMPTS } },
  });
  return result;
}
