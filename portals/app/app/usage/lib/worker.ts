/** Drain the durable C3 outbox in the long-running Node service. */
import { flushUsage } from "./flush";
let started = false;
export function startUsageWorker(): void {
  if (started) return;
  started = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await flushUsage();
      if (result.processed || result.exhausted) console.info("[usage/flush]", result);
    } catch { console.error("[usage/flush] unavailable; retry scheduled"); }
    finally { running = false; }
  };
  // Platform idempotency keys make retries safe across workers/restarts.
  setTimeout(() => { void tick(); }, 2_000).unref();
  setInterval(() => { void tick(); }, 30_000).unref();
}
