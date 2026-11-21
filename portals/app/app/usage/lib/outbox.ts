import { consumeReceipt } from "./receipt";

export interface UsageRow {
  id: string; workspaceId: string; product: string; metric: string;
  amount: number; idempotencyKey: string; flushAttempts: number;
}
export interface UsageUpdate {
  flushAttempts: { increment: number };
  flushed?: true; flushedAt?: Date; flushError: string | null;
}
export interface FlushResult {
  processed: number; succeeded: number; gated: number; failed: number;
  /** Retained, unacknowledged rows requiring operator review/retry. */
  exhausted: number;
}

/** A receipt is required before acknowledging durable usage. */
export async function flushBatch(rows: UsageRow[], deps: {
  report: (row: UsageRow) => Promise<Response>;
  save: (id: string, update: UsageUpdate) => Promise<unknown>;
  invalidate: (workspaceId: string) => void;
}): Promise<FlushResult> {
  const result: FlushResult = { processed: rows.length, succeeded: 0, gated: 0, failed: 0, exhausted: 0 };
  for (const row of rows) {
    let gated: boolean;
    try {
      if (row.product !== "arda") throw new Error("usage_product_mismatch");
      gated = (await consumeReceipt(await deps.report(row))).gated;
    } catch (error) {
      await deps.save(row.id, { flushAttempts: { increment: 1 },
        flushError: error instanceof Error ? error.message : "unknown" });
      result.failed++;
      continue;
    }
    // Persistence errors propagate. Retrying the unchanged idempotency key is safe.
    await deps.save(row.id, { flushed: true, flushedAt: new Date(),
      flushAttempts: { increment: 1 }, flushError: null });
    if (gated) {
      deps.invalidate(row.workspaceId);
      result.gated++;
    } else result.succeeded++;
  }
  return result;
}
