import { prisma } from "../../lib/db";

/** Workspace-scoped data access for Master Data governance (biz-432 v1,
 *  lightweight). Master data is not a separate model - it is the same
 *  Dataset rows the catalog domain already reads, filtered to
 *  goldenRecord=true (M-BL1). No matching/merge engine in v1; that stays
 *  future per the design doc. */
export interface MasterDataView {
  id: string;
  name: string;
  code: string;
  domain: string | null;
  team: string | null;
  type: string;
  updated: string;
  standardsCount: number;
}

export interface MasterDataMetrics {
  total: number;
  domains: number;
  standardsLinked: number;
}

export interface MasterDataData {
  records: MasterDataView[];
  metrics: MasterDataMetrics;
}

export async function getMasterData(workspaceId: string): Promise<MasterDataData> {
  const rows = await prisma.dataset.findMany({
    where: { workspaceId, goldenRecord: true },
    include: { standards: true },
    orderBy: { name: "asc" },
  });
  const records: MasterDataView[] = rows.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    domain: d.domain,
    team: d.team,
    type: d.type,
    updated: d.updatedAt.toISOString().slice(0, 10),
    standardsCount: d.standards.length,
  }));
  const metrics: MasterDataMetrics = {
    total: records.length,
    domains: new Set(records.map((r) => r.domain).filter((x): x is string => !!x)).size,
    standardsLinked: records.filter((r) => r.standardsCount > 0).length,
  };
  return { records, metrics };
}
