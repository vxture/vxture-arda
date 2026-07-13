import { prisma } from "../../lib/db";

// connectionConfig is deliberately ABSENT from the view: sealed credentials
// never enter a client component's payload (data-130 §2.1).
export interface DataSourceView {
  id: string;
  name: string;
  type: string;
  status: string;
  hasConfig: boolean;
  datasetCount: number;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface SourcesMetrics {
  total: number;
  connected: number;
  datasets: number;
  /** Plan cap for registered sources (platform limits; null = unlimited). */
  max: number | null;
}

export async function getDataSources(
  workspaceId: string,
  datasourceMax: number | null,
): Promise<{ sources: DataSourceView[]; metrics: SourcesMetrics }> {
  const rows = await prisma.dataSource.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { datasets: true } } },
  });

  const sources: DataSourceView[] = rows.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    status: s.status,
    hasConfig: s.connectionConfig !== null,
    datasetCount: s._count.datasets,
    lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }));

  return {
    sources,
    metrics: {
      total: sources.length,
      connected: sources.filter((s) => s.status === "connected").length,
      datasets: sources.reduce((n, s) => n + s.datasetCount, 0),
      max: datasourceMax,
    },
  };
}
