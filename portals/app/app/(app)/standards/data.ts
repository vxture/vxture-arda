import { prisma } from "../../lib/db";

/** Workspace-scoped data access for Data Standards, overlaid with the
 *  platform-provided standards (read-only). Metrics are computed from the rows,
 *  so they stay honest to what is actually catalogued. */
export interface StandardView {
  id: string;
  code: string;
  name: string;
  type: string;
  ref: string;
  items: number;
  usage: number;
  status: string;
  platform: boolean;
}

export interface StandardsMetrics {
  elements: number;
  codesets: number;
  references: number;
  pending: number;
}

export interface StandardsData {
  standards: StandardView[];
  metrics: StandardsMetrics;
}

export async function getStandards(workspaceId: string): Promise<StandardsData> {
  // Overlay: own workspace + platform-global rows (workspaceId NULL), read-only.
  const rows = await prisma.standard.findMany({
    where: { OR: [{ workspaceId }, { workspaceId: null }] },
    orderBy: [{ workspaceId: "asc" }, { code: "asc" }],
  });
  const standards: StandardView[] = rows.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    type: s.type,
    ref: s.ref,
    items: s.items,
    usage: s.usage,
    status: s.status,
    platform: s.workspaceId === null,
  }));
  const metrics: StandardsMetrics = {
    elements: standards.filter((s) => s.type === "data-element").length,
    codesets: standards.filter((s) => s.type === "code-set").length,
    references: standards.reduce((a, s) => a + s.usage, 0),
    pending: standards.filter((s) => s.status !== "published").length,
  };
  return { standards, metrics };
}
