import { getSession } from "../../../auth/lib/session";
import { getCatalogAsset } from "../data";
import { AssetDetail, AssetMissing } from "./asset-detail";

// Server component: resolve the workspace, load the dataset by id (workspace-
// scoped), and render the client detail. Reads cookies, so the route is dynamic.
export const dynamic = "force-dynamic";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const asset = session ? await getCatalogAsset(session.workspaceId, id) : null;
  if (!asset) return <AssetMissing />;
  return <AssetDetail asset={asset} />;
}
