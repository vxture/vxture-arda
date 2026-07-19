import { getSession } from "../../../auth/lib/session";
import { getQualityResults } from "../outcomes-data";
import { AlertsList } from "../alerts-list";

// Server component: load warn+fail quality results (the alert feed).
export const dynamic = "force-dynamic";

export default async function QualityAlertsPage() {
  const session = await getSession();
  const rows = session ? await getQualityResults(session.workspaceId, true) : [];
  return <AlertsList rows={rows} />;
}
