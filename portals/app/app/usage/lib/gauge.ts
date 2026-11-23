import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { METRICS } from "../../entitlement/quota";
import { platformRequest, workspacePlatformContext } from "../../platform/client";
import { HOSTED_STORAGE_SQL, hostedByteCount } from "./hosted-storage";

/** Commit the latest hosted-byte snapshot with the inventory change. */
export async function queueStorageGauge(tx: Prisma.TransactionClient, workspaceId: string): Promise<void> {
  const lock = `arda:storage-gauge:${workspaceId}`;
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
  const rows = await tx.$queryRawUnsafe<Array<{ bytes: bigint }>>(HOSTED_STORAGE_SQL, workspaceId);
  const value = BigInt(hostedByteCount(rows[0]?.bytes ?? 0n));
  // Keep the same observation for unchanged bytes, even when it is in flight.
  await tx.$executeRaw`INSERT INTO local_usage.storage_gauge AS previous
    ("workspaceId", "value", "observedAt", "retryAt")
    VALUES (${workspaceId}, ${value}, date_trunc('milliseconds', clock_timestamp()), now())
    ON CONFLICT ("workspaceId") DO UPDATE SET
      "value" = EXCLUDED."value",
      "observedAt" = GREATEST(EXCLUDED."observedAt", previous."observedAt" + interval '1 millisecond'),
      "retryAt" = EXCLUDED."retryAt"
    WHERE previous."value" <> EXCLUDED."value"`;
}

type GaugeSnapshot = { workspaceId: string; value: bigint; observedAt: Date };
type GaugeTransport = (snapshot: GaugeSnapshot) => Promise<unknown>;

async function sendGauge(snapshot: GaugeSnapshot): Promise<unknown> {
  const context = await workspacePlatformContext(snapshot.workspaceId);
  const response = await platformRequest("/usage/gauge", context, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspace_id: snapshot.workspaceId, product: "arda", metric: METRICS.STORAGE_BYTES,
      value: hostedByteCount(snapshot.value), observed_at: snapshot.observedAt.toISOString(),
    }),
  });
  if (!response.ok) throw new Error("storage_gauge_unavailable");
  return response.json();
}

export function matchesGaugeReceipt(raw: unknown, snapshot: GaugeSnapshot): boolean {
  if (!raw || typeof raw !== "object") return false;
  const ack = raw as Record<string, unknown>;
  return ack.workspace_id === snapshot.workspaceId && ack.product === "arda"
    && ack.metric === METRICS.STORAGE_BYTES && typeof ack.applied === "boolean"
    && (ack.value === snapshot.value.toString() || ack.value === hostedByteCount(snapshot.value))
    && typeof ack.observed_at === "string" && Date.parse(ack.observed_at) === snapshot.observedAt.getTime();
}

/** Reuse the usage worker. A crash or failed send leaves the same observation due. */
export async function flushStorageGauges(db = prisma, send: GaugeTransport = sendGauge, now = new Date()) {
  const due = await db.storageGauge.findMany({
    where: { retryAt: { lte: now } },
    orderBy: [{ retryAt: "asc" }, { workspaceId: "asc" }],
    take: 10,
  });
  let failed = 0;
  for (const snapshot of due) {
    const key = { workspaceId: snapshot.workspaceId, observedAt: snapshot.observedAt };
    // Claim only this observation; a dead worker's lease expires on its own.
    const retryAt = new Date(Date.now() + 60_000);
    const claimed = await db.storageGauge.updateMany({
      where: { ...key, retryAt: snapshot.retryAt }, data: { retryAt },
    });
    if (!claimed.count) continue;
    try {
      if (!matchesGaugeReceipt(await send(snapshot), snapshot)) throw new Error("storage_gauge_receipt_mismatch");
      await db.storageGauge.updateMany({ where: { ...key, retryAt }, data: { retryAt: null } });
    } catch {
      failed++;
    }
  }
  return { failed };
}
