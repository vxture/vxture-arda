import { getSession } from "../../auth/lib/session";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getDataSources } from "./data";
import { SourcesList } from "./sources-list";

// Server component: capability gating happens in this route's layout
// (ScreenGate); here we load workspace-scoped rows plus the plan cap so the
// list can show usage-vs-limit. Registration is admin-only (write surface).
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const session = await getSession();
  if (!session) return <SourcesList sources={[]} metrics={{ total: 0, connected: 0, datasets: 0, max: null }} isAdmin={false} />;

  const quota = await getEntitlementResolver().resolveQuota(session.workspaceId);
  const data = await getDataSources(session.workspaceId, quota.limits.datasourceMax);
  return <SourcesList sources={data.sources} metrics={data.metrics} isAdmin={isWorkspaceAdmin(session.roles)} />;
}
