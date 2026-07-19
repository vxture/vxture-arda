import { prisma } from "../../lib/db";
import type { AssetLevel } from "../dashboard/seed";

/** Service authoring data (Svc-BL5): every service with its linked dataset ids
 *  (for the edit form) + a dataset picker. Workspace-scoped. */
export interface ManagedService {
  id: string;
  code: string;
  name: string;
  path: string;
  method: string;
  type: string;
  level: AssetLevel;
  domain: string | null;
  description: string | null;
  status: string;
  datasetIds: string[];
}

export interface DatasetOption {
  id: string;
  name: string;
}

export async function getManagedServices(workspaceId: string): Promise<ManagedService[]> {
  const rows = await prisma.dataService.findMany({
    where: { workspaceId },
    orderBy: { code: "asc" },
    include: { datasets: { select: { datasetId: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    path: s.path,
    method: s.method,
    type: s.type,
    level: s.level as AssetLevel,
    domain: s.domain,
    description: s.description,
    status: s.status,
    datasetIds: s.datasets.map((d) => d.datasetId),
  }));
}

export async function getDatasetOptions(workspaceId: string): Promise<DatasetOption[]> {
  return prisma.dataset.findMany({
    where: { workspaceId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
}
