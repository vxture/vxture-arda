import { prisma } from "../../lib/db";
import type { AssetLevel } from "../dashboard/seed";

/**
 * Workspace-scoped Data Quality access. Joins each QualityRule to its target
 * Dataset (name + classification) and its two latest QualityResults to derive
 * the current pass rate, issue count, and trend. Metrics are computed from the
 * rules. The score-trend series and six-dimension radar remain presentation
 * aggregates on the client (not modelled per-rule in v1).
 */
export type Trend = "up" | "down" | "flat";

export interface QualityRuleView {
  id: string;
  code: string;
  name: string;
  target: string;
  dim: string;
  level: AssetLevel;
  pass: number | null;
  issues: number | null;
  trend: Trend;
  enabled: boolean;
}

export interface QualityMetrics {
  score: number;
  rules: number;
  issues: number;
  pending: number;
}

export interface QualityData {
  rules: QualityRuleView[];
  metrics: QualityMetrics;
}

export async function getQuality(workspaceId: string): Promise<QualityData> {
  const rows = await prisma.qualityRule.findMany({
    where: { workspaceId },
    orderBy: { code: "asc" },
    include: {
      dataset: { select: { name: true, classification: true } },
      results: { orderBy: { runAt: "desc" }, take: 2 },
    },
  });

  const rules: QualityRuleView[] = rows.map((r) => {
    const latest = r.results[0];
    const prev = r.results[1];
    let trend: Trend = "flat";
    if (latest?.score != null && prev?.score != null) {
      trend = latest.score > prev.score ? "up" : latest.score < prev.score ? "down" : "flat";
    }
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      target: r.dataset.name,
      dim: r.dimension,
      level: r.dataset.classification as AssetLevel,
      pass: latest?.score ?? null,
      issues: latest?.issues ?? null,
      trend,
      enabled: r.enabled,
    };
  });

  const passes = rules.map((r) => r.pass).filter((n): n is number => n != null);
  const metrics: QualityMetrics = {
    score: passes.length ? Math.round((passes.reduce((a, b) => a + b, 0) / passes.length) * 10) / 10 : 0,
    rules: rules.length,
    issues: rules.reduce((a, r) => a + (r.issues ?? 0), 0),
    pending: rows.filter((r) => String(r.results[0]?.status ?? "pass") !== "pass").length,
  };

  return { rules, metrics };
}

export interface DatasetOption {
  id: string;
  name: string;
}

/** Lightweight dataset picker for the create-rule form (id + name only). */
export async function getDatasetOptions(workspaceId: string): Promise<DatasetOption[]> {
  return prisma.dataset.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
}
