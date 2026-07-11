/**
 * ConsumeFlushJob: reads unflushed UsageRaw rows and POSTs them to the
 * platform consume endpoint (POST /usage/consume).
 *
 * Per handoff §2 / ent-120 §2 / reply-01 R5 (divisible 后报):
 *   - 200: consumed. Mark flushed=true, no error.
 *   - 409: quota exhausted. TERMINAL, not an error and NOT retried
 *           (reply-01 R5: "该行标记完成——不是 flushError，不重试"). Mark
 *           flushed=true with flushError=null, and evict the C2 cache so the
 *           next admission check re-pulls the now-exhausted remaining
 *           (reply-01 §5.1: gated is DERIVED from C2 remaining<=0, not a
 *           persistent flag; C2 self-heals on period reset).
 *   - Other: transient error. Increment flushAttempts, keep flushed=false.
 *
 * Max attempts: MAX_ATTEMPTS (default 5). After that, log and give up
 * (mark flushed=true with error) to avoid an infinite retry loop.
 *
 * NOTE: varda.credit is ATOMIC pre-deduct (reply-01 R5) - it consumes
 * synchronously BEFORE the AI op, not through this async buffer/flush path.
 *
 * This job is triggered by GET /api/usage/flush (see route). Callers may
 * invoke it on startup, on a schedule, or after each significant operation.
 */

import { prisma } from "../../lib/db";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { assertInternalTarget } from "../../lib/internal-target";

const FLUSH_BATCH = 50;
const MAX_ATTEMPTS = 5;

interface ConsumeRequest {
  workspace_id: string;
  product: string;
  metric: string;
  amount: number;
  idempotency_key: string;
}

interface FlushResult {
  processed: number;
  succeeded: number;
  gated: number;
  failed: number;
  abandoned: number;
}

export async function flushUsage(): Promise<FlushResult> {
  const baseUrl = process.env.PLATFORM_API_URL;
  const authToken = process.env.PLATFORM_INTERNAL_AUTH_TOKEN;

  if (!baseUrl || !authToken) {
    // Platform not configured - skip silently (local dev)
    return { processed: 0, succeeded: 0, gated: 0, failed: 0, abandoned: 0 };
  }

  // Fail fast rather than POST usage (with the S2S secret) to a public host
  // over cleartext http (plat-220 §4/B1). Misconfig -> throw, caught by caller.
  assertInternalTarget(baseUrl);

  const rows = await prisma.usageRaw.findMany({
    where: { flushed: false, flushAttempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: FLUSH_BATCH,
  });

  const result: FlushResult = { processed: rows.length, succeeded: 0, gated: 0, failed: 0, abandoned: 0 };

  for (const row of rows) {
    if (row.flushAttempts >= MAX_ATTEMPTS) {
      await prisma.usageRaw.update({
        where: { id: row.id },
        data: { flushed: true, flushError: "max_attempts_exceeded" },
      });
      result.abandoned++;
      continue;
    }

    try {
      const body: ConsumeRequest = {
        workspace_id: row.workspaceId,
        product: row.product,
        metric: row.metric,
        amount: row.amount,
        idempotency_key: row.idempotencyKey,
      };

      const res = await fetch(`${baseUrl}/usage/consume`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-vxture-internal-auth": authToken,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 200 || res.status === 409) {
        // Drain the body (replayed/gated/consumed) even if unused, so the socket
        // is freed; 409 is a normal terminal outcome, never a flushError.
        await res.json().catch(() => ({}));
        await prisma.usageRaw.update({
          where: { id: row.id },
          data: {
            flushed: true,
            flushedAt: new Date(),
            flushAttempts: row.flushAttempts + 1,
            flushError: null,
          },
        });
        if (res.status === 409) {
          // Terminal, no retry. Evict C2 so the next admission check sees the
          // exhausted remaining (reply-01 §5.1 gated-derivation).
          getEntitlementResolver().invalidateCache(row.workspaceId);
          result.gated++;
        } else {
          result.succeeded++;
        }
      } else {
        await prisma.usageRaw.update({
          where: { id: row.id },
          data: {
            flushAttempts: row.flushAttempts + 1,
            flushError: `http_${res.status}`,
          },
        });
        result.failed++;
      }
    } catch (err) {
      await prisma.usageRaw.update({
        where: { id: row.id },
        data: {
          flushAttempts: row.flushAttempts + 1,
          flushError: err instanceof Error ? err.message : "unknown",
        },
      });
      result.failed++;
    }
  }

  return result;
}
