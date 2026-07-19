import { getSession } from "../../../auth/lib/session";
import { isWorkspaceAdmin } from "../../../entitlement/roles";
import { getTags } from "../tags-data";
import { TagsList } from "../tags-list";

export const dynamic = "force-dynamic";

export default async function MetaTagsPage() {
  const session = await getSession();
  const tags = session ? await getTags(session.workspaceId) : [];
  return <TagsList tags={tags} isAdmin={isWorkspaceAdmin(session?.roles)} />;
}
