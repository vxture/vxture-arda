import { getProductSession as getSession } from "../../auth/lib/session";
import { getApiKeys } from "./data";
import { ApiKeysList } from "./apikeys-list";

// Server component: role + capability gating happens in this route's layout
// (ScreenGate); here we only load workspace-scoped rows.
export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const session = await getSession();
  const data = session
    ? await getApiKeys(session.workspaceId)
    : { keys: [], metrics: { total: 0, active: 0, revoked: 0 } };
  return <ApiKeysList keys={data.keys} metrics={data.metrics} />;
}
