import { getSession } from "../../auth/lib/session";
import { getStandards } from "./data";
import { StandardsList } from "./standards-list";

// Server component: load the workspace's standards from the DB, compute metrics,
// and hand them to the client list. Reads cookies, so the route is dynamic.
export const dynamic = "force-dynamic";

export default async function StandardsPage() {
  const session = await getSession();
  const data = session
    ? await getStandards(session.workspaceId)
    : { standards: [], metrics: { elements: 0, codesets: 0, references: 0, pending: 0 } };
  return <StandardsList standards={data.standards} metrics={data.metrics} />;
}
