import { prisma } from "../../lib/db";

/**
 * Tag catalog (biz-422 business metadata, MD-BL3): the workspace's tags with
 * how many datasets each labels. Tag rows already exist; this is the missing
 * management surface. Read-only here; writes live in tags-actions.ts.
 */
export interface TagView {
  id: string;
  name: string;
  color: string | null;
  count: number;
}

export async function getTags(workspaceId: string): Promise<TagView[]> {
  const rows = await prisma.tag.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    include: { _count: { select: { datasets: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, count: r._count.datasets }));
}
