import { getPermissionSession as getSession } from "../../../auth/lib/session";
import { permits } from "../../../authz/policy";
import { getTags } from "../tags-data";
import { TagsList } from "../tags-list";

export const dynamic = "force-dynamic";

export default async function MetaTagsPage() {
  const session = await getSession();
  const tags = session ? await getTags(session.workspaceId) : [];
  return <TagsList tags={tags} isAdmin={permits(session?.productAccess,"data.write")} />;
}
