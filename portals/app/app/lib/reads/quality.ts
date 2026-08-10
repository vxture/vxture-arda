import { prisma } from "../db";
import { pageOf } from "../api/pagination";

/**
 * Workspace-scoped quality reads for the external /api/v1 surface. Quality
 * rules and results are tenant data only (QualityRule.workspaceId is non-null,
 * no platform overlay), so every query force-filters on workspaceId.
 */

export interface QualityRuleSummary {
  id: string;
  code: string;
  name: string;
  datasetId: string;
  datasetName: string;
  dimension: string;
  type: string;
  severity: string;
  enabled: boolean;
}

export interface ListQualityRulesParams {
  limit: number;
  cursorId?: string;
  datasetId?: string;
  enabled?: boolean;
}

export async function listQualityRules(
  workspaceId: string,
  params: ListQualityRulesParams,
): Promise<{ data: QualityRuleSummary[]; nextCursor: string | null }> {
  const rows = await prisma.qualityRule.findMany({
    where: {
      workspaceId,
      ...(params.datasetId ? { datasetId: params.datasetId } : {}),
      ...(params.enabled === undefined ? {} : { enabled: params.enabled }),
    },
    include: { dataset: { select: { name: true } } },
    orderBy: [{ code: "asc" }, { id: "asc" }],
    take: params.limit + 1,
    ...(params.cursorId ? { cursor: { id: params.cursorId }, skip: 1 } : {}),
  });
  const page = pageOf(rows, params.limit);
  return {
    data: page.data.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      datasetId: r.datasetId,
      datasetName: r.dataset.name,
      dimension: r.dimension,
      type: r.type,
      severity: r.severity,
      enabled: r.enabled,
    })),
    nextCursor: page.nextCursor,
  };
}

export interface QualityResultSummary {
  id: string;
  ruleId: string;
  datasetId: string;
  runAt: string;
  status: string;
  score: number | null;
  issues: number;
}

export interface ListQualityResultsParams {
  limit: number;
  cursorId?: string;
  datasetId?: string;
  ruleId?: string;
  status?: string;
}

export async function listQualityResults(
  workspaceId: string,
  params: ListQualityResultsParams,
): Promise<{ data: QualityResultSummary[]; nextCursor: string | null }> {
  const rows = await prisma.qualityResult.findMany({
    where: {
      workspaceId,
      ...(params.datasetId ? { datasetId: params.datasetId } : {}),
      ...(params.ruleId ? { ruleId: params.ruleId } : {}),
      ...(params.status ? { status: params.status as never } : {}),
    },
    orderBy: [{ runAt: "desc" }, { id: "asc" }],
    take: params.limit + 1,
    ...(params.cursorId ? { cursor: { id: params.cursorId }, skip: 1 } : {}),
  });
  const page = pageOf(rows, params.limit);
  return {
    data: page.data.map((r) => ({
      id: r.id,
      ruleId: r.ruleId,
      datasetId: r.datasetId,
      runAt: r.runAt.toISOString(),
      status: r.status,
      score: r.score,
      issues: r.issues,
    })),
    nextCursor: page.nextCursor,
  };
}
