import { getSession } from "../../../auth/lib/session";
import { getServiceMonitor } from "../monitor-data";
import { MonitorView } from "../monitor-view";

export const dynamic = "force-dynamic";

export default async function SvcMonitorPage() {
  const session = await getSession();
  const mon = session
    ? await getServiceMonitor(session.workspaceId)
    : { totalCalls: 0, windowCalls: 0, services: 0, byService: [], recent: [] };
  return <MonitorView mon={mon} />;
}
