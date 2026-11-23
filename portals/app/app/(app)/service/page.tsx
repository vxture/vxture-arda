import { getPermissionSession as getSession } from "../../auth/lib/session";
import { permits } from "../../authz/policy";
import { getServices } from "./data";
import { ServiceList } from "./service-list";

// Server component: load the workspace's published data services from the DB.
// Reads cookies, so the route is dynamic.
export const dynamic = "force-dynamic";

export default async function ServicePage() {
  const session = await getSession();
  const services = session ? await getServices(session.workspaceId) : [];
  return <ServiceList services={services} isAdmin={permits(session?.productAccess,"service.publish")} />;
}
