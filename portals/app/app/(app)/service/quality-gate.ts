import { prisma } from "../../lib/db";

/**
 * Quality gate for data service admission (Q-BL2): publishing reads the
 * quality state of every linked dataset. Scores are DERIVED from the latest
 * QualityResult per rule - never stored (biz-100 §3.5).
 *
 * v1 policy (product-owned):
 *  - BLOCK when any linked dataset's latest result on a critical-severity
 *    rule is `fail`.
 *  - WARN (publish proceeds, recorded in audit) when a dataset's aggregate
 *    score is below WARN_SCORE or it has no results at all (never checked).
 */

const WARN_SCORE = 60;

export interface QualityGateVerdict {
  allowed: boolean;
  blockers: Array<{ datasetName: string; ruleName: string }>;
  warnings: Array<{ datasetName: string; reason: "low_score" | "never_checked"; score: number | null }>;
}

function statusScore(status: string, score: number | null): number {
  if (score !== null) return score;
  return status === "pass" ? 100 : status === "warn" ? 70 : 0;
}

export async function qualityGate(workspaceId: string, dataServiceId: string): Promise<QualityGateVerdict> {
  const links = await prisma.dataServiceDataset.findMany({
    where: { workspaceId, dataServiceId },
    select: { datasetId: true },
  });
  const verdict: QualityGateVerdict = { allowed: true, blockers: [], warnings: [] };
  if (links.length === 0) return verdict; // no data bound - nothing to gate on

  const datasets = await prisma.dataset.findMany({
    where: { workspaceId, id: { in: links.map((l) => l.datasetId) } },
    include: {
      qualityRules: {
        where: { enabled: true },
        include: { results: { orderBy: { runAt: "desc" }, take: 1 } },
      },
    },
  });

  for (const ds of datasets) {
    const latest = ds.qualityRules
      .map((r) => ({ rule: r, result: r.results[0] }))
      .filter((x) => x.result);

    if (latest.length === 0) {
      verdict.warnings.push({ datasetName: ds.name, reason: "never_checked", score: null });
      continue;
    }
    for (const { rule, result } of latest) {
      if (rule.severity === "critical" && result!.status === "fail") {
        verdict.blockers.push({ datasetName: ds.name, ruleName: rule.name });
      }
    }
    const avg =
      latest.reduce((sum, x) => sum + statusScore(x.result!.status, x.result!.score), 0) / latest.length;
    if (avg < WARN_SCORE) {
      verdict.warnings.push({ datasetName: ds.name, reason: "low_score", score: Math.round(avg) });
    }
  }

  verdict.allowed = verdict.blockers.length === 0;
  return verdict;
}
