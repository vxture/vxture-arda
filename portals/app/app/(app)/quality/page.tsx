import { getSession } from "../../auth/lib/session";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getDatasetOptions, getQuality } from "./data";
import { QualityList } from "./quality-list";

// Server component: load the workspace's quality rules + derived metrics from the
// DB and hand them to the client view. Reads cookies, so the route is dynamic.
export const dynamic = "force-dynamic";

export default async function QualityPage() {
  const session = await getSession();
  const [data, datasets] = session
    ? await Promise.all([getQuality(session.workspaceId), getDatasetOptions(session.workspaceId)])
    : [{ rules: [], metrics: { score: 0, rules: 0, issues: 0, pending: 0 } }, []];
  return <QualityList rules={data.rules} metrics={data.metrics} datasets={datasets} isAdmin={isWorkspaceAdmin(session?.roles)} />;
}
