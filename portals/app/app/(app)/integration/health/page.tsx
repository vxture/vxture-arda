import { getSession } from "../../../auth/lib/session";
import { getSourceHealth } from "../health-data";
import { HealthView } from "../health-view";

export const dynamic = "force-dynamic";

export default async function IntHealthPage() {
  const session = await getSession();
  const health = session
    ? await getSourceHealth(session.workspaceId)
    : { total: 0, fresh: 0, aging: 0, stale: 0, failed: 0, sources: [] };
  return <HealthView health={health} />;
}
