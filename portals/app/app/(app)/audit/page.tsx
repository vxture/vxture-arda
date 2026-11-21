import { getProductSession as getSession } from "../../auth/lib/session";
import { getAuditLog } from "./data";
import { AuditList } from "./audit-list";

// Server component: role + capability gating happens in this route's layout
// (ScreenGate); here we only load workspace-scoped rows.
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await getSession();
  const data = session
    ? await getAuditLog(session.workspaceId)
    : { entries: [], metrics: { total: 0, platformActions: 0, last24h: 0 } };
  return <AuditList entries={data.entries} metrics={data.metrics} />;
}
