import { prisma } from "../../lib/db";
import type { AssetLevel } from "./seed";

/**
 * Server-side catalog data access. Every query is scoped to the caller's
 * workspace (the isolation key). Maps the v1 Dataset row to the catalog view;
 * quality / subscriberCount / fieldCount are NOT stored in v1 - they are derived
 * later (QualityResult aggregate, subscription join, Field count) and surface as
 * null ("-") until those subsystems land.
 */
export interface CatalogAssetView {
  id: string;
  name: string;
  code: string;
  domain: string | null;
  team: string | null;
  level: AssetLevel;
  type: string;
  rows: string;
  refreshFreq: string | null;
  updated: string;
  owner: string | null;
  description: string | null;
  quality: number | null;
  subs: number | null;
  fields: number | null;
}

function formatCount(n: bigint | null): string {
  if (n == null) return "-";
  const v = Number(n);
  if (v >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(v);
}

type DatasetRecord = {
  id: string;
  name: string;
  code: string;
  domain: string | null;
  team: string | null;
  classification: string;
  type: string;
  rowCountEst: bigint | null;
  refreshFreq: string | null;
  updatedAt: Date;
  ownerUserId: string | null;
  description: string | null;
};

function toView(d: DatasetRecord): CatalogAssetView {
  return {
    id: d.id,
    name: d.name,
    code: d.code,
    domain: d.domain,
    team: d.team,
    level: d.classification as AssetLevel,
    type: d.type,
    rows: formatCount(d.rowCountEst),
    refreshFreq: d.refreshFreq,
    updated: d.updatedAt.toISOString().slice(0, 10),
    owner: d.ownerUserId,
    description: d.description,
    quality: null,
    subs: null,
    fields: null,
  };
}

/** Derived quality score for a set of rules-with-latest-result (biz-100 3.5:
 *  never stored). pass=100 / warn=70 / fail=0 when the run carried no score. */
function scoreOf(status: string, score: number | null): number {
  if (score !== null) return score;
  return status === "pass" ? 100 : status === "warn" ? 70 : 0;
}

/** Batch-derive per-dataset quality scores (latest result per rule). */
async function qualityScores(workspaceId: string): Promise<Map<string, number>> {
  const rules = await prisma.qualityRule.findMany({
    where: { workspaceId, enabled: true },
    select: { datasetId: true, results: { orderBy: { runAt: "desc" }, take: 1, select: { status: true, score: true } } },
  });
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of rules) {
    const latest = r.results[0];
    if (!latest) continue;
    const a = acc.get(r.datasetId) ?? { sum: 0, n: 0 };
    a.sum += scoreOf(latest.status, latest.score);
    a.n += 1;
    acc.set(r.datasetId, a);
  }
  return new Map([...acc].map(([id, a]) => [id, Math.round((a.sum / a.n) * 10) / 10]));
}

export async function getCatalogAssets(workspaceId: string): Promise<CatalogAssetView[]> {
  const [rows, scores] = await Promise.all([
    prisma.dataset.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
    qualityScores(workspaceId),
  ]);
  return rows.map((d) => ({ ...toView(d), quality: scores.get(d.id) ?? null }));
}

export async function getCatalogAsset(workspaceId: string, id: string): Promise<CatalogAssetView | null> {
  const row = await prisma.dataset.findFirst({ where: { workspaceId, id } });
  return row ? toView(row) : null;
}

// ---- Asset profile (A-BL1 result-face aggregation + A-BL2 storage) ----------
// The profile assembles what the other rings already produce - quality
// (biz-433), lineage (biz-434), services (biz-441), source (biz-410),
// classification (biz-435), tags - all derived at read time, nothing stored.

export interface AssetProfile extends CatalogAssetView {
  qualityDetail: { total: number; pass: number; warn: number; fail: number; lastRunAt: string | null };
  lineage: { upstream: number; downstream: number; services: string[] };
  source: { name: string; type: string; lastSyncedAt: string | null } | null;
  storage: { bytes: string; sharePct: number | null };
  tags: string[];
}

function formatBytes(n: bigint | null): string {
  if (n == null) return "-";
  const v = Number(n);
  if (v >= 1 << 30) return (v / (1 << 30)).toFixed(1) + " GB";
  if (v >= 1 << 20) return (v / (1 << 20)).toFixed(1) + " MB";
  if (v >= 1024) return (v / 1024).toFixed(1) + " KB";
  return v + " B";
}

export async function getAssetProfile(workspaceId: string, id: string): Promise<AssetProfile | null> {
  const row = await prisma.dataset.findFirst({
    where: { workspaceId, id },
    include: {
      source: { select: { name: true, type: true, lastSyncedAt: true } },
      tags: { include: { tag: { select: { name: true } } } },
      qualityRules: {
        where: { enabled: true },
        select: { results: { orderBy: { runAt: "desc" }, take: 1, select: { status: true, score: true, runAt: true } } },
      },
      services: { include: { service: { select: { name: true } } } },
    },
  });
  if (!row) return null;

  const [upstream, downstream, totalAgg] = await Promise.all([
    prisma.lineageEdge.count({ where: { workspaceId, downstreamDatasetId: id } }),
    prisma.lineageEdge.count({ where: { workspaceId, upstreamDatasetId: id } }),
    prisma.dataset.aggregate({ where: { workspaceId }, _sum: { sizeBytes: true } }),
  ]);

  let sum = 0;
  let pass = 0;
  let warn = 0;
  let fail = 0;
  let lastRunAt: Date | null = null;
  const latest = row.qualityRules.map((r) => r.results[0]).filter((x): x is NonNullable<typeof x> => !!x);
  for (const res of latest) {
    sum += scoreOf(res.status, res.score);
    if (res.status === "pass") pass += 1;
    else if (res.status === "warn") warn += 1;
    else fail += 1;
    if (!lastRunAt || res.runAt > lastRunAt) lastRunAt = res.runAt;
  }

  const total = Number(totalAgg._sum.sizeBytes ?? 0n);
  return {
    ...toView(row),
    quality: latest.length > 0 ? Math.round((sum / latest.length) * 10) / 10 : null,
    subs: row.services.length,
    qualityDetail: {
      total: latest.length,
      pass,
      warn,
      fail,
      lastRunAt: lastRunAt?.toISOString() ?? null,
    },
    lineage: { upstream, downstream, services: row.services.map((l) => l.service.name) },
    source: row.source
      ? { name: row.source.name, type: row.source.type, lastSyncedAt: row.source.lastSyncedAt?.toISOString() ?? null }
      : null,
    storage: {
      bytes: formatBytes(row.sizeBytes),
      sharePct: row.sizeBytes != null && total > 0 ? Math.round((Number(row.sizeBytes) / total) * 1000) / 10 : null,
    },
    tags: row.tags.map((t) => t.tag.name),
  };
}
