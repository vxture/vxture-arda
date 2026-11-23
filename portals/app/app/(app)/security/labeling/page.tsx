import { getPermissionSession as getSession } from "../../../auth/lib/session";
import { permits } from "../../../authz/policy";
import { getLabelingData } from "../labeling-data";
import { LabelingView } from "../labeling-view";

export const dynamic = "force-dynamic";

export default async function SecLabelingPage() {
  const session = await getSession();
  const data = session ? await getLabelingData(session.workspaceId) : { rows: [], byLevel: [], total: 0 };
  return <LabelingView data={data} isAdmin={permits(session?.productAccess,"product.manage")} />;
}
