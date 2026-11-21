import { getProductSession as getSession } from "../../../auth/lib/session";
import { getSyncLogs } from "../logs-data";
import { LogsView } from "../logs-view";

export const dynamic = "force-dynamic";

export default async function IntLogsPage() {
  const session = await getSession();
  const data = session ? await getSyncLogs(session.workspaceId) : { rows: [], total: 0, syncs: 0, failures: 0 };
  return <LogsView data={data} />;
}
