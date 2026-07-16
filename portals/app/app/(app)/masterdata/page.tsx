import { getSession } from "../../auth/lib/session";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getMasterData } from "./data";
import { MasterDataList } from "./masterdata-list";

// Server component: load the workspace's golden-record datasets from the DB
// and hand them to the client list. Reads cookies, so the route is dynamic.
export const dynamic = "force-dynamic";

export default async function MasterDataPage() {
  const session = await getSession();
  const data = session
    ? await getMasterData(session.workspaceId)
    : { records: [], metrics: { total: 0, domains: 0, standardsLinked: 0 } };
  return (
    <MasterDataList
      records={data.records}
      metrics={data.metrics}
      isAdmin={isWorkspaceAdmin(session?.roles)}
    />
  );
}
