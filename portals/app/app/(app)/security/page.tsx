import { getSession } from "../../auth/lib/session";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getDatasetOptions, getPolicies, getSecurity } from "./data";
import { SecurityList } from "./security-list";

// Server component: classification distribution + counts + policies come
// from the DB (workspace-scoped). Reads cookies, so the route is dynamic.
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await getSession();
  const [data, policies, datasets] = session
    ? await Promise.all([getSecurity(session.workspaceId), getPolicies(session.workspaceId), getDatasetOptions(session.workspaceId)])
    : [{ dist: [], total: 0, coreCount: 0, coverage: 0 }, { maxExternalLevel: "internal" as const, maskingRules: [] }, []];
  return <SecurityList data={data} policies={policies} datasets={datasets} isAdmin={isWorkspaceAdmin(session?.roles)} />;
}
