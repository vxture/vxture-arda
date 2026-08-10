import { prisma } from "../db";
import { pageOf } from "../api/pagination";

/**
 * Workspace-scoped catalog reads for the external /api/v1 surface.
 *
 * Same isolation rules as the UI read layer ((app)/catalog/data.ts): every
 * query is scoped to the caller's workspace plus the read-only platform
 * overlay (workspaceId NULL = platform-global reference data). Shapes differ
 * from the UI views on purpose - the API returns raw values (numbers, ISO
 * timestamps, enum strings), never display formatting.
 *
 * Per data-170 1.3 the response carries classification (AssetLevel) and
 * provenance (ownerApp / source) so consumers can propagate both.
 */

function workspaceOrPlatform(workspaceId: string) {
  return { OR: [{ workspaceId }, { workspaceId: null }] };
}

export interface DatasetSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  domain: string | null;
  team: string | null;
  type: string;
  classification: string;
  scope: "workspace" | "platform";
  ownerApp: string | null;
  ownerUserId: string | null;
  goldenRecord: boolean;
  rowCountEst: number | null;
  sizeBytes: number | null;
  refreshFreq: string | null;
  createdAt: string;
  updatedAt: string;
}

type DatasetRow = {
  id: string;
  workspaceId: string | null;
  code: string;
  name: string;
  description: string | null;
  domain: string | null;
  team: string | null;
  type: string;
  classification: string;
  ownerApp: string | null;
  ownerUserId: string | null;
  goldenRecord: boolean;
  rowCountEst: bigint | null;
  sizeBytes: bigint | null;
  refreshFreq: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toDatasetSummary(d: DatasetRow): DatasetSummary {
  return {
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description,
    domain: d.domain,
    team: d.team,
    type: d.type,
    classification: d.classification,
    scope: d.workspaceId === null ? "platform" : "workspace",
    ownerApp: d.ownerApp,
    ownerUserId: d.ownerUserId,
    goldenRecord: d.goldenRecord,
    rowCountEst: d.rowCountEst == null ? null : Number(d.rowCountEst),
    sizeBytes: d.sizeBytes == null ? null : Number(d.sizeBytes),
    refreshFreq: d.refreshFreq,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export interface ListDatasetsParams {
  limit: number;
  cursorId?: string;
  q?: string;
  domain?: string;
  classification?: string;
  type?: string;
}

export async function listDatasets(
  workspaceId: string,
  params: ListDatasetsParams,
): Promise<{ data: DatasetSummary[]; nextCursor: string | null }> {
  const rows = await prisma.dataset.findMany({
    where: {
      ...workspaceOrPlatform(workspaceId),
      ...(params.q ? { OR: [{ name: { contains: params.q, mode: "insensitive" } }, { code: { contains: params.q, mode: "insensitive" } }] } : {}),
      ...(params.domain ? { domain: params.domain } : {}),
      ...(params.classification ? { classification: params.classification as never } : {}),
      ...(params.type ? { type: params.type } : {}),
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: params.limit + 1,
    ...(params.cursorId ? { cursor: { id: params.cursorId }, skip: 1 } : {}),
  });
  const page = pageOf(rows, params.limit);
  return { data: page.data.map(toDatasetSummary), nextCursor: page.nextCursor };
}

/** Single-dataset summary fetch (used by POST create/replay responses). */
export async function getDatasetSummary(workspaceId: string, id: string): Promise<DatasetSummary | null> {
  const row = await prisma.dataset.findFirst({ where: { id, ...workspaceOrPlatform(workspaceId) } });
  return row ? toDatasetSummary(row) : null;
}

/** Derived score for one latest result (biz-100 3.5, never stored). */
function scoreOf(status: string, score: number | null): number {
  if (score !== null) return score;
  return status === "pass" ? 100 : status === "warn" ? 70 : 0;
}

export interface DatasetDetail extends DatasetSummary {
  location: string | null;
  source: { id: string; name: string; type: string; lastSyncedAt: string | null } | null;
  tags: Array<{ id: string; name: string }>;
  standards: Array<{ id: string; code: string; name: string }>;
  services: Array<{ id: string; code: string; name: string }>;
  quality: {
    score: number | null;
    rules: number;
    pass: number;
    warn: number;
    fail: number;
    lastRunAt: string | null;
  };
  lineage: { upstream: number; downstream: number };
}

export async function getDatasetDetail(workspaceId: string, id: string): Promise<DatasetDetail | null> {
  const row = await prisma.dataset.findFirst({
    where: { id, ...workspaceOrPlatform(workspaceId) },
    include: {
      source: { select: { id: true, name: true, type: true, lastSyncedAt: true } },
      tags: { include: { tag: { select: { id: true, name: true } } } },
      standards: { include: { standard: { select: { id: true, code: true, name: true } } } },
      services: { include: { service: { select: { id: true, code: true, name: true } } } },
      qualityRules: {
        where: { enabled: true },
        select: { results: { orderBy: { runAt: "desc" }, take: 1, select: { status: true, score: true, runAt: true } } },
      },
    },
  });
  if (!row) return null;

  // Platform reference rows (workspaceId NULL) carry no workspace-scoped
  // lineage; LineageEdge.workspaceId is non-null, so their counts are zero.
  const scope = row.workspaceId;
  const [upstream, downstream] = await Promise.all([
    scope == null ? 0 : prisma.lineageEdge.count({ where: { workspaceId: scope, downstreamDatasetId: id } }),
    scope == null ? 0 : prisma.lineageEdge.count({ where: { workspaceId: scope, upstreamDatasetId: id } }),
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

  return {
    ...toDatasetSummary(row),
    location: row.location,
    source: row.source
      ? {
          id: row.source.id,
          name: row.source.name,
          type: row.source.type,
          lastSyncedAt: row.source.lastSyncedAt?.toISOString() ?? null,
        }
      : null,
    tags: row.tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    standards: row.standards.map((l) => l.standard),
    services: row.services.map((l) => l.service),
    quality: {
      score: latest.length > 0 ? Math.round((sum / latest.length) * 10) / 10 : null,
      rules: latest.length,
      pass,
      warn,
      fail,
      lastRunAt: lastRunAt?.toISOString() ?? null,
    },
    lineage: { upstream, downstream },
  };
}
