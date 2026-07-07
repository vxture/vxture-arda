/**
 * UsageBuffer: writes billable events to local_usage (UsageRaw table).
 * The platform consume endpoint is NOT called here; a separate flush job
 * drains the buffer asynchronously (see flush.ts).
 *
 * Per handoff §2 boundary discipline: arda only buffers and reports.
 * The platform consume service is the single writer of authoritative quota.
 *
 * idempotencyKey must be stable for the same logical operation (retry-safe).
 * Recommended format: "<product>:<metric>:<operation-uuid>".
 */

import { prisma } from "../../lib/db";

export interface RecordUsageParams {
  workspaceId: string;
  metric: string;
  amount?: number;
  idempotencyKey: string;
}

export async function recordUsage(params: RecordUsageParams): Promise<void> {
  const { workspaceId, metric, amount = 1, idempotencyKey } = params;
  // upsert: if key already exists this is a replay - no-op
  await prisma.usageRaw.upsert({
    where: { idempotencyKey },
    create: { workspaceId, metric, amount, idempotencyKey },
    update: {}, // replay: do not change existing row
  });
}
