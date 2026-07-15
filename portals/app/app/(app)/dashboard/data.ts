import { prisma } from "../../lib/db";
import { DOMAINS, type AssetLevel } from "./seed";

/**
 * Workspace-scoped dashboard aggregates from the DB, one query set per major
 * block (biz-460 dashboard-08 information architecture): core metrics, data
 * assets, data services, data quality, data standards, data security, data
 * aggregation (business/team/external contribution), and risk alerts. The
 * growth trend, quality dimensions, and alert copy remain presentation
 * aggregates on the client (timeseries/rating tables not modelled in v1 -
 * same TD-036-style honesty as admin: no fabricated numbers, only real counts
 * and real "new in period" deltas computed from createdAt).
 */

export type Period = "month" | "quarter" | "year" | "all";

const TEAM_COLOR: Record<string, string> = {
  platform: "var(--vx-color-brand-600)",
  analytics: "var(--vx-color-info-600)",
  engineering: "var(--vx-color-teal-600)",
  growth: "var(--vx-color-success-600)",
  finance: "var(--vx-color-warning-500)",
  ops: "var(--vx-color-gray-600)",
};

/** Start of the given period window; `undefined` for "all" (no lower bound). */
function periodStart(period: Period): Date | undefined {
  const now = new Date();
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  return undefined;
}

function formatCount(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function formatBytesParts(n: number): { value: string; unit: string } {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return { value: i === 0 ? String(v) : v.toFixed(1).replace(/\.0$/, ""), unit: units[i] };
}

function formatBytes(n: number): string {
  const { value, unit } = formatBytesParts(n);
  return value + unit;
}

export interface DashTopAsset {
  id: string;
  name: string;
  code: string;
  domain: string | null;
  level: AssetLevel;
}

export interface DashServiceRow {
  id: string;
  code: string;
  name: string;
  method: string;
  status: string;
}

export interface DashSourceRow {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface DashStandardRow {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
}

export interface DashboardData {
  period: Period;
  // core metrics
  datasetCount: number;
  capacityValue: string;
  capacityUnit: string;
  capacityNewInPeriod: string;
  datasetNewInPeriod: number;
  serviceCount: number;
  serviceNewInPeriod: number;
  qualityScore: number;
  qualityRunsInPeriod: number;
  // data assets
  domainDonut: { key: string; value: number; color: string }[];
  topAssets: DashTopAsset[];
  // data services
  servicesRunning: number;
  servicesList: DashServiceRow[];
  // data standards
  standardsTotal: number;
  standardsPublished: number;
  standardsList: DashStandardRow[];
  // data security
  apiKeysActive: number;
  policiesEnabled: number;
  // data aggregation (7.1 business / 7.2 team / 7.3 external)
  businessContribution: { key: string; value: number; color: string }[];
  teamContribution: { key: string; value: number; color: string }[];
  sourcesTotal: number;
  sourcesConnected: number;
  sourcesList: DashSourceRow[];
}

export async function getDashboard(workspaceId: string, period: Period = "month"): Promise<DashboardData> {
  const since = periodStart(period);
  const sinceFilter = since ? { createdAt: { gte: since } } : {};

  const [
    datasetCount,
    capacityAgg,
    capacityNewAgg,
    datasetNewInPeriod,
    byDomain,
    byDomainInPeriod,
    byTeamInPeriod,
    top,
    qAvg,
    qualityRunsInPeriod,
    serviceCount,
    serviceNewInPeriod,
    servicesRunning,
    servicesList,
    standardsTotal,
    standardsPublished,
    standardsList,
    apiKeysActive,
    policiesEnabled,
    sourcesTotal,
    sourcesConnected,
    sourcesList,
  ] = await Promise.all([
    prisma.dataset.count({ where: { workspaceId } }),
    prisma.dataset.aggregate({ where: { workspaceId }, _sum: { sizeBytes: true } }),
    prisma.dataset.aggregate({ where: { workspaceId, ...sinceFilter }, _sum: { sizeBytes: true } }),
    prisma.dataset.count({ where: { workspaceId, ...sinceFilter } }),
    prisma.dataset.groupBy({ by: ["domain"], where: { workspaceId }, _count: { _all: true } }),
    prisma.dataset.groupBy({ by: ["domain"], where: { workspaceId, ...sinceFilter }, _count: { _all: true } }),
    prisma.dataset.groupBy({ by: ["team"], where: { workspaceId, ...sinceFilter }, _count: { _all: true } }),
    prisma.dataset.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, code: true, domain: true, classification: true },
    }),
    prisma.qualityResult.aggregate({ where: { workspaceId }, _avg: { score: true } }),
    prisma.qualityResult.count({ where: { workspaceId, ...(since ? { runAt: { gte: since } } : {}) } }),
    prisma.dataService.count({ where: { workspaceId } }),
    prisma.dataService.count({ where: { workspaceId, ...sinceFilter } }),
    prisma.dataService.count({ where: { workspaceId, status: "running" } }),
    prisma.dataService.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, code: true, name: true, method: true, status: true },
    }),
    prisma.standard.count({ where: { workspaceId } }),
    prisma.standard.count({ where: { workspaceId, status: "published" } }),
    prisma.standard.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, code: true, name: true, type: true, status: true },
    }),
    prisma.apiKey.count({ where: { workspaceId, revoked: false } }),
    prisma.policy.count({ where: { workspaceId, enabled: true } }),
    prisma.dataSource.count({ where: { workspaceId } }),
    prisma.dataSource.count({ where: { workspaceId, status: "connected" } }),
    prisma.dataSource.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, type: true, status: true },
    }),
  ]);

  const domainDonut = byDomain
    .filter((d) => d.domain)
    .map((d) => ({ key: d.domain as string, value: d._count._all, color: DOMAINS[d.domain as string]?.color ?? "var(--vx-color-gray-500)" }))
    .sort((a, b) => b.value - a.value);

  const businessContribution = byDomainInPeriod
    .filter((d) => d.domain)
    .map((d) => ({ key: d.domain as string, value: d._count._all, color: DOMAINS[d.domain as string]?.color ?? "var(--vx-color-gray-500)" }))
    .sort((a, b) => b.value - a.value);

  const teamContribution = byTeamInPeriod
    .filter((d) => d.team)
    .map((d) => ({ key: d.team as string, value: d._count._all, color: TEAM_COLOR[d.team as string] ?? "var(--vx-color-gray-500)" }))
    .sort((a, b) => b.value - a.value);

  const capacityParts = formatBytesParts(Number(capacityAgg._sum.sizeBytes ?? 0n));

  return {
    period,
    datasetCount,
    capacityValue: capacityParts.value,
    capacityUnit: capacityParts.unit,
    capacityNewInPeriod: formatBytes(Number(capacityNewAgg._sum.sizeBytes ?? 0n)),
    datasetNewInPeriod,
    serviceCount,
    serviceNewInPeriod,
    qualityScore: qAvg._avg.score != null ? Math.round(qAvg._avg.score * 10) / 10 : 0,
    qualityRunsInPeriod,
    domainDonut,
    topAssets: top.map((d) => ({ id: d.id, name: d.name, code: d.code, domain: d.domain, level: d.classification as AssetLevel })),
    servicesRunning,
    servicesList: servicesList.map((s) => ({ id: s.id, code: s.code, name: s.name, method: s.method, status: s.status })),
    standardsTotal,
    standardsPublished,
    standardsList: standardsList.map((s) => ({ id: s.id, code: s.code, name: s.name, type: s.type, status: s.status })),
    apiKeysActive,
    policiesEnabled,
    businessContribution,
    teamContribution,
    sourcesTotal,
    sourcesConnected,
    sourcesList: sourcesList.map((s) => ({ id: s.id, name: s.name, type: s.type, status: s.status })),
  };
}

export { formatCount };
