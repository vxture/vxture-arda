import { prisma } from "../../lib/db";

/**
 * Quality OUTCOME data (arda-biz-433 result ring): the check-results feed, the
 * alert feed (warn/fail only), and the aggregate report. All read straight from
 * QualityResult / QualityRule - no new model, no writes. The score-per-status
 * fallback matches the catalog derivation (biz-100 3.5: derived, never stored).
 */

/** pass=100 / warn=70 / fail=0 when the run carried no explicit score. */
function scoreOf(status: string, score: number | null): number {
  if (score !== null) return score;
  return status === "pass" ? 100 : status === "warn" ? 70 : 0;
}

export interface QualityResultView {
  id: string;
  ruleName: string;
  ruleCode: string;
  dataset: string;
  dim: string;
  status: string; // pass | warn | fail
  score: number | null;
  issues: number;
  ranAt: string;
}

/** Recent check results, newest first. `onlyAlerts` keeps warn+fail only. */
export async function getQualityResults(workspaceId: string, onlyAlerts = false): Promise<QualityResultView[]> {
  const rows = await prisma.qualityResult.findMany({
    where: { workspaceId, ...(onlyAlerts ? { status: { in: ["warn", "fail"] } } : {}) },
    orderBy: { runAt: "desc" },
    take: 200,
    include: {
      rule: { select: { name: true, code: true, dimension: true } },
      dataset: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    ruleName: r.rule.name,
    ruleCode: r.rule.code,
    dataset: r.dataset.name,
    dim: r.rule.dimension,
    status: String(r.status),
    score: r.score,
    issues: r.issues,
    ranAt: r.runAt.toISOString(),
  }));
}

export interface QualityReport {
  totalRules: number;
  score: number | null;
  passRate: number | null;
  distribution: { pass: number; warn: number; fail: number };
  sixDim: Array<{ key: string; score: number }>;
  byDomain: Array<{ domain: string; score: number; runs: number }>;
  lastRunAt: string | null;
}

/** Aggregate report over the latest result of each enabled rule (current
 *  health), grouped by quality dimension and by dataset subject domain. */
export async function getQualityReport(workspaceId: string): Promise<QualityReport> {
  const rules = await prisma.qualityRule.findMany({
    where: { workspaceId, enabled: true },
    select: {
      dimension: true,
      dataset: { select: { domain: true } },
      results: { orderBy: { runAt: "desc" }, take: 1, select: { status: true, score: true, runAt: true } },
    },
  });

  const dist = { pass: 0, warn: 0, fail: 0 };
  const dimAcc = new Map<string, { sum: number; n: number }>();
  const domAcc = new Map<string, { sum: number; n: number }>();
  let scoreSum = 0;
  let scoreN = 0;
  let lastRunAt: Date | null = null;

  for (const r of rules) {
    const latest = r.results[0];
    if (!latest) continue;
    const s = String(latest.status);
    if (s === "pass" || s === "warn" || s === "fail") dist[s] += 1;
    const val = scoreOf(s, latest.score);
    scoreSum += val;
    scoreN += 1;
    const d = dimAcc.get(r.dimension) ?? { sum: 0, n: 0 };
    d.sum += val;
    d.n += 1;
    dimAcc.set(r.dimension, d);
    const domKey = r.dataset.domain ?? "";
    const dm = domAcc.get(domKey) ?? { sum: 0, n: 0 };
    dm.sum += val;
    dm.n += 1;
    domAcc.set(domKey, dm);
    if (!lastRunAt || latest.runAt > lastRunAt) lastRunAt = latest.runAt;
  }

  const round1 = (x: number) => Math.round(x * 10) / 10;
  const rated = dist.pass + dist.warn + dist.fail;

  return {
    totalRules: rules.length,
    score: scoreN ? round1(scoreSum / scoreN) : null,
    passRate: rated ? Math.round((dist.pass / rated) * 1000) / 10 : null,
    distribution: dist,
    sixDim: [...dimAcc.entries()].map(([key, a]) => ({ key, score: round1(a.sum / a.n) })),
    byDomain: [...domAcc.entries()]
      .map(([domain, a]) => ({ domain, score: round1(a.sum / a.n), runs: a.n }))
      .sort((a, b) => b.runs - a.runs),
    lastRunAt: lastRunAt?.toISOString() ?? null,
  };
}
