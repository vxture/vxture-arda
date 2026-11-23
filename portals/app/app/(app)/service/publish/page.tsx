import { getPermissionSession as getSession } from "../../../auth/lib/session";
import { permits } from "../../../authz/policy";
import { getDatasetOptions, getManagedServices } from "../publish-data";
import { PublishForm } from "../publish-form";

// Server component: load the workspace's services (with linked datasets) and
// the dataset picker for the authoring form.
export const dynamic = "force-dynamic";

export default async function SvcPublishPage() {
  const session = await getSession();
  const [services, datasets] = session
    ? await Promise.all([getManagedServices(session.workspaceId), getDatasetOptions(session.workspaceId)])
    : [[], []];
  return <PublishForm services={services} datasets={datasets} isAdmin={permits(session?.productAccess,"service.publish")} />;
}
