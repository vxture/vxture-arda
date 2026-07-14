import { getSession } from "../../auth/lib/session";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getServices } from "./data";
import { ServiceList } from "./service-list";

// Server component: load the workspace's published data services from the DB.
// Reads cookies, so the route is dynamic.
export const dynamic = "force-dynamic";

export default async function ServicePage() {
  const session = await getSession();
  const services = session ? await getServices(session.workspaceId) : [];
  return <ServiceList services={services} isAdmin={isWorkspaceAdmin(session?.roles)} />;
}
