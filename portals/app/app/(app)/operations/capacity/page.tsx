import { getSession } from "../../../auth/lib/session";
import { getCapacityProfile } from "../capacity-data";
import { CapacityView } from "../capacity-view";

export const dynamic = "force-dynamic";

export default async function OpsCapacityPage() {
  const session = await getSession();
  const cap = session
    ? await getCapacityProfile(session.workspaceId)
    : { totalBytes: "0 B", totalBytesRaw: 0, datasetCount: 0, byDomain: [], byLevel: [], top: [] };
  return <CapacityView cap={cap} />;
}
