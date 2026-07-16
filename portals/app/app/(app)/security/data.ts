import { prisma } from "../../lib/db";
import type { AssetLevel } from "../dashboard/seed";

/**
 * Workspace-scoped Data Security access. The classification distribution, level
 * strip, core-asset count, coverage, and access/masking policies (Sec-BL1/BL2)
 * are computed from the DB (real). A "blocked calls" count would need a
 * persisted enforcement-event log, which does not exist in v1 - not modelled,
 * not shown. The sharing-request queue is a workflow with no v1 entity, so it
 * stays as static demo in the client (flagged, see seed.ts).
 */
const LEVEL_ORDER: AssetLevel[] = ["public", "internal", "sensitive", "core"];
const LEVEL_COLOR: Record<AssetLevel, string> = {
  public: "var(--vx-color-success-600)",
  internal: "var(--vx-color-info-600)",
  sensitive: "var(--vx-color-warning-500)",
  core: "var(--vx-color-danger-600)",
};

export interface SecurityData {
  dist: { key: AssetLevel; value: number; color: string }[];
  total: number;
  coreCount: number;
  coverage: number;
}

export async function getSecurity(workspaceId: string): Promise<SecurityData> {
  const grouped = await prisma.dataset.groupBy({
    by: ["classification"],
    where: { workspaceId },
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const g of grouped) counts.set(String(g.classification), g._count._all);

  const dist = LEVEL_ORDER.map((k) => ({ key: k, value: counts.get(k) ?? 0, color: LEVEL_COLOR[k] }));
  const total = dist.reduce((a, d) => a + d.value, 0);
  const coreCount = counts.get("core") ?? 0;
  // Every dataset carries a classification (enum, non-null), so any catalogued
  // workspace is fully covered; 0 when empty.
  const coverage = total ? 100 : 0;

  return { dist, total, coreCount, coverage };
}

const DEFAULT_MAX_EXTERNAL: AssetLevel = "internal";

export interface MaskingRuleView {
  id: string;
  datasetId: string | null;
  datasetName: string | null;
  fields: string[];
  strategy: string;
}

export interface PolicyData {
  maxExternalLevel: AssetLevel;
  maskingRules: MaskingRuleView[];
}

/** Access + masking policies (Sec-BL1/Sec-BL2), mirrors the resolution order
 *  in service/egress-policy.ts: last enabled access policy wins, all enabled
 *  masking policies accumulate. */
export async function getPolicies(workspaceId: string): Promise<PolicyData> {
  const rows = await prisma.policy.findMany({
    where: { workspaceId, enabled: true, type: { in: ["access", "masking"] } },
    orderBy: { createdAt: "asc" },
  });

  let maxExternalLevel: AssetLevel = DEFAULT_MAX_EXTERNAL;
  const maskingRules: MaskingRuleView[] = [];
  const datasetIds = new Set<string>();

  for (const p of rows) {
    const cfg = (p.config ?? {}) as Record<string, unknown>;
    if (p.type === "access") {
      if (typeof cfg.maxExternalLevel === "string" && LEVEL_ORDER.includes(cfg.maxExternalLevel as AssetLevel)) {
        maxExternalLevel = cfg.maxExternalLevel as AssetLevel;
      }
    } else if (p.type === "masking") {
      const datasetId = typeof cfg.datasetId === "string" ? cfg.datasetId : null;
      if (datasetId) datasetIds.add(datasetId);
      maskingRules.push({
        id: p.id,
        datasetId,
        datasetName: null,
        fields: Array.isArray(cfg.fields) ? cfg.fields.filter((f): f is string => typeof f === "string") : [],
        strategy: typeof cfg.strategy === "string" ? cfg.strategy : "redact",
      });
    }
  }

  if (datasetIds.size > 0) {
    const datasets = await prisma.dataset.findMany({
      where: { workspaceId, id: { in: [...datasetIds] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(datasets.map((d) => [d.id, d.name]));
    for (const rule of maskingRules) {
      if (rule.datasetId) rule.datasetName = nameById.get(rule.datasetId) ?? null;
    }
  }

  return { maxExternalLevel, maskingRules };
}

export interface DatasetOption {
  id: string;
  name: string;
}

/** Lightweight dataset picker for the masking-rule form (id + name only). */
export async function getDatasetOptions(workspaceId: string): Promise<DatasetOption[]> {
  return prisma.dataset.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
}
