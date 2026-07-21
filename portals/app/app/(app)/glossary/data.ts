import { prisma } from "../../lib/db";

export interface GlossaryTermView {
  id: string;
  term: string;
  definition: string;
  steward: string | null;
  /** platform = ops-curated global reference (read-only overlay); workspace = tenant-local. */
  scope: "workspace" | "platform";
}

/** Workspace terms plus the platform read-only overlay - the ONLY sanctioned
 *  widening of the force-filter (data-110 2.4, single helper, read-only). */
export async function getGlossary(workspaceId: string): Promise<GlossaryTermView[]> {
  const rows = await prisma.glossaryTerm.findMany({
    where: { OR: [{ workspaceId }, { workspaceId: null }] },
    orderBy: [{ scope: "desc" }, { term: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    term: r.term,
    definition: r.definition,
    steward: r.stewardUserId,
    scope: r.scope as "workspace" | "platform",
  }));
}
