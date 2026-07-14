import { prisma } from "../../lib/db";
import { DOMAINS, type AssetLevel } from "./seed";

/**
 * Workspace-scoped dashboard aggregates from the DB: total assets, ingested
 * volume, domain distribution, team contribution, top assets, and an overall
 * quality score (avg of quality results). The growth trend, service-call metric,
 * quality dimensions, and alerts remain presentation aggregates on the client
 * (telemetry/timeseries not modelled in v1).
 */
const TEAM_COLOR: Record<string, string> = {
  platform: "var(--vx-color-brand-600)",
  analytics: "var(--vx-color-info-600)",
  engineering: "var(--vx-color-teal-600)",
  growth: "var(--vx-color-success-600)",
  finance: "var(--vx-color-warning-500)",
  ops: "var(--vx-color-gray-600)",
};

export interface DashTopAsset {
  id: string;
  name: string;
  code: string;
  domain: string | null;
  level: AssetLevel;
}

export interface DashboardModuleCounts {
  sourcesTotal: number;
  sourcesConnected: number;
  standardsTotal: number;
  standardsPublished: number;
  lineageEdges: number;
  servicesTotal: number;
  servicesRunning: number;
  apiKeysActive: number;
}

export interface DashboardData {
  total: number;
  volume: string;
  compliance: number;
  qualityScore: number;
  domainDonut: { key: string; value: number; color: string }[];
  teamBars: { key: string; value: number; color: string }[];
  topAssets: DashTopAsset[];
  modules: DashboardModuleCounts;
}

function formatCount(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export async function getDashboard(workspaceId: string): Promise<DashboardData> {
  const [
    total,
    volumeAgg,
    byDomain,
    byTeam,
    top,
    qAvg,
    sourcesTotal,
    sourcesConnected,
    standardsTotal,
    standardsPublished,
    lineageEdges,
    servicesTotal,
    servicesRunning,
    apiKeysActive,
  ] = await Promise.all([
    prisma.dataset.count({ where: { workspaceId } }),
    prisma.dataset.aggregate({ where: { workspaceId }, _sum: { rowCountEst: true } }),
    prisma.dataset.groupBy({ by: ["domain"], where: { workspaceId }, _count: { _all: true } }),
    prisma.dataset.groupBy({ by: ["team"], where: { workspaceId }, _count: { _all: true } }),
    prisma.dataset.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, code: true, domain: true, classification: true },
    }),
    prisma.qualityResult.aggregate({ where: { workspaceId }, _avg: { score: true } }),
    prisma.dataSource.count({ where: { workspaceId } }),
    prisma.dataSource.count({ where: { workspaceId, status: "connected" } }),
    prisma.standard.count({ where: { workspaceId } }),
    prisma.standard.count({ where: { workspaceId, status: "published" } }),
    prisma.lineageEdge.count({ where: { workspaceId } }),
    prisma.dataService.count({ where: { workspaceId } }),
    prisma.dataService.count({ where: { workspaceId, status: "running" } }),
    prisma.apiKey.count({ where: { workspaceId, revoked: false } }),
  ]);

  const domainDonut = byDomain
    .filter((d) => d.domain)
    .map((d) => ({ key: d.domain as string, value: d._count._all, color: DOMAINS[d.domain as string]?.color ?? "var(--vx-color-gray-500)" }))
    .sort((a, b) => b.value - a.value);

  const teamBars = byTeam
    .filter((d) => d.team)
    .map((d) => ({ key: d.team as string, value: d._count._all, color: TEAM_COLOR[d.team as string] ?? "var(--vx-color-gray-500)" }))
    .sort((a, b) => b.value - a.value);

  return {
    total,
    volume: formatCount(Number(volumeAgg._sum.rowCountEst ?? 0n)),
    compliance: total ? 100 : 0,
    qualityScore: qAvg._avg.score != null ? Math.round(qAvg._avg.score * 10) / 10 : 0,
    domainDonut,
    teamBars,
    topAssets: top.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      domain: d.domain,
      level: d.classification as AssetLevel,
    })),
    modules: {
      sourcesTotal,
      sourcesConnected,
      standardsTotal,
      standardsPublished,
      lineageEdges,
      servicesTotal,
      servicesRunning,
      apiKeysActive,
    },
  };
}
