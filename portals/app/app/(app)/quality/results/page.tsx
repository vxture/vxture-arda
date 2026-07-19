import { getSession } from "../../../auth/lib/session";
import { getQualityResults } from "../outcomes-data";
import { ResultsList } from "../results-list";

// Server component: load recent quality check results for the workspace.
export const dynamic = "force-dynamic";

export default async function QualityResultsPage() {
  const session = await getSession();
  const rows = session ? await getQualityResults(session.workspaceId) : [];
  return <ResultsList rows={rows} />;
}
