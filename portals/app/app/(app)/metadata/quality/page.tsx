import { getProductSession as getSession } from "../../../auth/lib/session";
import { getMetaQuality } from "../metaquality-data";
import { MetaQualityView } from "../metaquality-view";

export const dynamic = "force-dynamic";

export default async function MetaQualityPage() {
  const session = await getSession();
  const data = session
    ? await getMetaQuality(session.workspaceId)
    : { rows: [], avgScore: null, complete: 0, total: 0, byField: [] };
  return <MetaQualityView data={data} />;
}
