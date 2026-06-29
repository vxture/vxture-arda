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

export async function getCatalogAssets(workspaceId: string): Promise<CatalogAssetView[]> {
  const rows = await prisma.dataset.findMany({ where: { workspaceId }, orderBy: { name: "asc" } });
  return rows.map(toView);
}

export async function getCatalogAsset(workspaceId: string, id: string): Promise<CatalogAssetView | null> {
  const row = await prisma.dataset.findFirst({ where: { workspaceId, id } });
  return row ? toView(row) : null;
}
