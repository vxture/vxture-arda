/**
 * ConsumeFlushJob: reads unflushed UsageRaw rows and POSTs them to the
 * platform consume endpoint (POST /usage/consume).
 *
 * Per handoff §2 / ent-120 §2:
 *   - 200: consumed. Mark flushed=true.
 *   - 409: quota exhausted (gated). Also mark flushed=true - quota state is
 *           authoritative on the platform; we do not retry gated events.
 *   - Other: transient error. Increment flushAttempts, keep flushed=false.
 *
 * Max attempts: FLUSH_MAX_ATTEMPTS (default 5). After that, log and give up
 * (mark flushed=true with error) to avoid an infinite retry loop.
 *
 * This job is triggered by GET /api/usage/flush (see route). Callers may
 * invoke it on startup, on a schedule, or after each significant operation.
 */

import { prisma } from "../../lib/db";

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
        const data = (await res.json()) as { replayed?: boolean; gated?: boolean };
        await prisma.usageRaw.update({
          where: { id: row.id },
          data: {
            flushed: true,
            flushedAt: new Date(),
            flushAttempts: row.flushAttempts + 1,
            flushError: data.gated ? "quota_exhausted" : null,
          },
        });
        if (res.status === 409) result.gated++;
        else result.succeeded++;
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
