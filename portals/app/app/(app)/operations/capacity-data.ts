import { prisma } from "../../lib/db";
import type { AssetLevel } from "../catalog/seed";

/**
 * Capacity profile (biz-107 operations, decision 3 "capacity view"): storage
 * occupancy across the workspace's datasets - total, by subject domain, by
 * classification, and the largest datasets. Quota water-line / alerting is
 * platform-owned (deep link only), NOT computed here.
 */
export interface BytesRow {
  key: string;
  bytes: number;
}

export interface CapacityProfile {
  totalBytes: string;
  totalBytesRaw: number;
  datasetCount: number;
  byDomain: BytesRow[];
  byLevel: Array<{ level: AssetLevel; bytes: number }>;
  top: Array<{ name: string; bytes: number; pct: number }>;
}

const LEVELS: AssetLevel[] = ["public", "internal", "sensitive", "core"];

export function formatBytes(n: number): string {
  if (n >= 1 << 30) return (n / (1 << 30)).toFixed(1) + " GB";
  if (n >= 1 << 20) return (n / (1 << 20)).toFixed(1) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

export async function getCapacityProfile(workspaceId: string): Promise<CapacityProfile> {
  const rows = await prisma.dataset.findMany({
    where: { workspaceId },
    select: { name: true, domain: true, classification: true, sizeBytes: true },
  });

  const byDomain = new Map<string, number>();
  const byLevel = new Map<string, number>();
  let total = 0;
  const sized: Array<{ name: string; bytes: number }> = [];

  for (const r of rows) {
    const b = Number(r.sizeBytes ?? 0n);
    total += b;
    byDomain.set(r.domain ?? "", (byDomain.get(r.domain ?? "") ?? 0) + b);
    byLevel.set(r.classification, (byLevel.get(r.classification) ?? 0) + b);
    if (b > 0) sized.push({ name: r.name, bytes: b });
  }

  return {
    totalBytes: formatBytes(total),
    totalBytesRaw: total,
    datasetCount: rows.length,
    byDomain: [...byDomain.entries()]
      .map(([key, bytes]) => ({ key, bytes }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 12),
    byLevel: LEVELS.map((level) => ({ level, bytes: byLevel.get(level) ?? 0 })),
    top: sized
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8)
      .map((d) => ({ name: d.name, bytes: d.bytes, pct: total > 0 ? Math.round((d.bytes / total) * 1000) / 10 : 0 })),
  };
}
