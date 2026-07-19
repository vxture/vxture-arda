import { prisma } from "../../lib/db";

/**
 * Source freshness health (biz-410 result ring): reads DataSource.status and
 * lastSyncedAt and buckets each source by how recently it synced. No sync is
 * triggered here - this is the read-only "who is fresh / stale / failed" view.
 */
export interface SourceHealthRow {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSyncedAt: string | null;
  ageHours: number | null;
  bucket: "fresh" | "aging" | "stale" | "never" | "failed";
}

export interface SourceHealth {
  total: number;
  fresh: number;
  aging: number;
  stale: number;
  failed: number;
  sources: SourceHealthRow[];
}

const FAILED = new Set(["error", "failed", "disconnected"]);

export async function getSourceHealth(workspaceId: string, now = Date.now()): Promise<SourceHealth> {
  const rows = await prisma.dataSource.findMany({
    where: { workspaceId },
    select: { id: true, name: true, type: true, status: true, lastSyncedAt: true },
    orderBy: { lastSyncedAt: "asc" },
  });

  let fresh = 0;
  let aging = 0;
  let stale = 0;
  let failed = 0;

  const sources: SourceHealthRow[] = rows.map((r) => {
    const ageHours = r.lastSyncedAt ? (now - r.lastSyncedAt.getTime()) / 3.6e6 : null;
    let bucket: SourceHealthRow["bucket"];
    if (FAILED.has(r.status)) {
      bucket = "failed";
      failed += 1;
    } else if (ageHours == null) {
      bucket = "never";
      stale += 1;
    } else if (ageHours <= 24) {
      bucket = "fresh";
      fresh += 1;
    } else if (ageHours <= 24 * 7) {
      bucket = "aging";
      aging += 1;
    } else {
      bucket = "stale";
      stale += 1;
    }
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      status: r.status,
      lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null,
      ageHours: ageHours == null ? null : Math.round(ageHours),
      bucket,
    };
  });

  return { total: rows.length, fresh, aging, stale, failed, sources };
}
