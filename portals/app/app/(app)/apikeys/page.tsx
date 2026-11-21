import { getProductSession as getSession } from "../../auth/lib/session";
import { getApiKeys } from "./data";
import { ApiKeysList } from "./apikeys-list";
import { prisma } from "../../lib/db";

// Server component: role + capability gating happens in this route's layout
// (ScreenGate); here we only load workspace-scoped rows.
export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const session = await getSession();
  const [data, services] = session
    ? await Promise.all([getApiKeys(session.workspaceId), prisma.dataService.findMany({
      where: { workspaceId: session.workspaceId }, select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    })])
    : [{ keys: [], metrics: { total: 0, active: 0, revoked: 0 } }, []];
  return <ApiKeysList keys={data.keys} metrics={data.metrics} services={services} />;
}
