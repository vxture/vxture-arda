import { prisma } from "../../lib/db";
import type { AssetLevel } from "./seed";

/**
 * Asset inventory (biz-421 "how many"): counts of the workspace's datasets by
 * subject domain, owning team and classification, plus ownership coverage and
 * total storage. Pure aggregation over Dataset - nothing stored.
 */
export interface CountRow {
  key: string;
  count: number;
}

export interface AssetInventory {
  total: number;
  byDomain: CountRow[];
  byTeam: CountRow[];
  byLevel: Array<{ level: AssetLevel; count: number }>;
  totalBytes: string;
  withOwner: number;
  golden: number;
}

const LEVELS: AssetLevel[] = ["public", "internal", "sensitive", "core"];

function formatBytes(n: number): string {
  if (n >= 1 << 30) return (n / (1 << 30)).toFixed(1) + " GB";
  if (n >= 1 << 20) return (n / (1 << 20)).toFixed(1) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

function topCounts(map: Map<string, number>, limit = 12): CountRow[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getAssetInventory(workspaceId: string): Promise<AssetInventory> {
  const rows = await prisma.dataset.findMany({
    where: { workspaceId },
    select: { domain: true, team: true, classification: true, sizeBytes: true, ownerUserId: true, goldenRecord: true },
  });

  const byDomain = new Map<string, number>();
  const byTeam = new Map<string, number>();
  const levelCount = new Map<string, number>();
  let bytes = 0;
  let withOwner = 0;
  let golden = 0;

  for (const r of rows) {
    const d = r.domain ?? "";
    byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
    const t = r.team ?? "";
    byTeam.set(t, (byTeam.get(t) ?? 0) + 1);
    levelCount.set(r.classification, (levelCount.get(r.classification) ?? 0) + 1);
    bytes += Number(r.sizeBytes ?? 0n);
    if (r.ownerUserId) withOwner += 1;
    if (r.goldenRecord) golden += 1;
  }

  return {
    total: rows.length,
    byDomain: topCounts(byDomain),
    byTeam: topCounts(byTeam),
    byLevel: LEVELS.map((level) => ({ level, count: levelCount.get(level) ?? 0 })),
    totalBytes: formatBytes(bytes),
    withOwner,
    golden,
  };
}
