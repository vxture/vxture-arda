import { getSession } from "../../../auth/lib/session";
import { getAssetInventory } from "../inventory-data";
import { InventoryView } from "../inventory-view";

export const dynamic = "force-dynamic";

export default async function AssetInventoryPage() {
  const session = await getSession();
  const inv = session
    ? await getAssetInventory(session.workspaceId)
    : { total: 0, byDomain: [], byTeam: [], byLevel: [], totalBytes: "0 B", withOwner: 0, golden: 0 };
  return <InventoryView inv={inv} />;
}
