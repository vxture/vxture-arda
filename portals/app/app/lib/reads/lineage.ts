import { prisma } from "../db";

/**
 * Workspace-scoped lineage reads for the external /api/v1 surface.
 *
 * v1 exposes the curated dataset-level lineage (LineageEdge, the SoT) as a raw
 * edge list plus a dataset name map - no layout, no derived scores (biz-100
 * 3.5). Graph traversal is the consumer's concern. The cap is reported via
 * `truncated`, never silent.
 */

export const LINEAGE_EDGE_CAP = 500;

export interface LineageEdgeView {
  id: string;
  upstreamDatasetId: string;
  downstreamDatasetId: string;
  transform: string | null;
  jobId: string | null;
}

export interface LineageGraph {
  edges: LineageEdgeView[];
  datasets: Array<{ id: string; code: string; name: string }>;
  truncated: boolean;
}

export async function getLineageGraph(workspaceId: string, datasetId?: string): Promise<LineageGraph> {
  const rows = await prisma.lineageEdge.findMany({
    where: {
      workspaceId,
      ...(datasetId ? { OR: [{ upstreamDatasetId: datasetId }, { downstreamDatasetId: datasetId }] } : {}),
    },
    orderBy: { id: "asc" },
    take: LINEAGE_EDGE_CAP + 1,
  });

  const truncated = rows.length > LINEAGE_EDGE_CAP;
  const edges = truncated ? rows.slice(0, LINEAGE_EDGE_CAP) : rows;

  const ids = new Set<string>();
  for (const e of edges) {
    ids.add(e.upstreamDatasetId);
    ids.add(e.downstreamDatasetId);
  }
  if (datasetId) ids.add(datasetId);

  const datasets = ids.size
    ? await prisma.dataset.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, code: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return {
    edges: edges.map((e) => ({
      id: e.id,
      upstreamDatasetId: e.upstreamDatasetId,
      downstreamDatasetId: e.downstreamDatasetId,
      transform: e.transform,
      jobId: e.jobId,
    })),
    datasets,
    truncated,
  };
}

/** Whether the dataset is visible to the workspace (tenant + platform overlay). */
export async function datasetVisible(workspaceId: string, datasetId: string): Promise<boolean> {
  const row = await prisma.dataset.findFirst({
    where: { id: datasetId, OR: [{ workspaceId }, { workspaceId: null }] },
    select: { id: true },
  });
  return row !== null;
}
