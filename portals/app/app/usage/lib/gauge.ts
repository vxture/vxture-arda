/**
 * Storage gauge reporting (arda_200 3.2 / plat-300 item 5).
 *
 * storage.bytes is a GAUGE, not a counter: arda reports the ABSOLUTE
 * workspace watermark (SUM of Dataset.sizeBytes) via PUT /usage/gauge with a
 * mandatory observed_at; the platform orders writes last-write-wins by
 * observed_at (an older snapshot returns applied:false and is dropped -
 * idempotent by design). Never sent through consume (reply-01 R4).
 *
 * Report points = write paths that move the watermark: source sync (sizes
 * change) and the lifecycle hard-delete sweep (drops to zero). Best-effort:
 * a failed report never fails the caller - the next sync re-reports the
 * absolute value, so gaps self-heal (that is the point of gauges).
 */

import { prisma } from "../../lib/db";
import { METRICS } from "../../entitlement/quota";
import { assertInternalTarget } from "../../lib/internal-target";

const TIMEOUT_MS = 5_000;

export async function reportStorageGauge(workspaceId: string): Promise<void> {
  const baseUrl = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_INTERNAL_AUTH_TOKEN;
  if (!baseUrl || !token) return; // local dev / CI: silently skip

  try {
    assertInternalTarget(baseUrl);
    const agg = await prisma.dataset.aggregate({
      where: { workspaceId },
      _sum: { sizeBytes: true },
    });
    const value = Number(agg._sum.sizeBytes ?? 0n);

    const res = await fetch(`${baseUrl}/usage/gauge`, {
      method: "PUT",
      headers: {
        "x-vxture-internal-auth": token,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        product: "arda",
        metric: METRICS.STORAGE_BYTES,
        value,
        observed_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[gauge] storage report ${res.status} for ws=${workspaceId}`);
    }
  } catch (err) {
    // Best-effort: log and move on; the next watermark change re-reports.
    console.warn(`[gauge] storage report failed for ws=${workspaceId}:`, err);
  }
}
