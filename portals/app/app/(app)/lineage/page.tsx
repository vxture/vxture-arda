import { getPermissionSession as getSession } from "../../auth/lib/session";
import { permits } from "../../authz/policy";
import { getLineage } from "./data";
import { LineageCanvas } from "./lineage-view";

// Server component (L-BL1): the lineage graph is read from the DB
// (DataSource -> Dataset -> DataService plus curated LineageEdge rows) and
// laid out server-side; the client component only renders and edits.
export const dynamic = "force-dynamic";

export default async function LineagePage({
  searchParams,
}: {
  searchParams: Promise<{ dataset?: string }>;
}) {
  const session = await getSession();
  const { dataset } = await searchParams;
  const view = session
    ? await getLineage(session.workspaceId, dataset)
    : { nodes: [], edges: [], datasets: [], subjectId: null, impact: { datasets: 0, services: 0, names: [] }, truncated: false };
  return <LineageCanvas view={view} isAdmin={permits(session?.productAccess,"data.write")} />;
}
