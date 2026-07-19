import { getSession } from "../../auth/lib/session";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getApprovalData } from "./data";
import { ApprovalsView } from "./approvals-view";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await getSession();
  const isAdmin = isWorkspaceAdmin(session?.roles);
  const data = session
    ? await getApprovalData(session.workspaceId, session.sub, isAdmin)
    : { pending: [], mine: [], pendingCount: 0 };
  return <ApprovalsView data={data} isAdmin={isAdmin} />;
}
