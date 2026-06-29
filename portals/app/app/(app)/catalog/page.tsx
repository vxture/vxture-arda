import { getSession } from "../../auth/lib/session";
import { getCatalogAssets } from "./data";
import { CatalogList } from "./catalog-list";

// Server component: resolve the caller's workspace, load its datasets from the
// DB (workspace-scoped), and hand them to the client list. Reads cookies, so the
// route is dynamic.
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const session = await getSession();
  const assets = session ? await getCatalogAssets(session.workspaceId) : [];
  return <CatalogList assets={assets} />;
}
