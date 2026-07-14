import { getSession } from "../../auth/lib/session";
import { getDashboard } from "./data";
import { DashboardClient } from "./dashboard-client";

// Server component: load workspace aggregates (totals, domain/team distribution,
// top assets, quality) from the DB. Reads cookies, so the route is dynamic.
export const dynamic = "force-dynamic";

const EMPTY = {
  total: 0,
  volume: "0",
  compliance: 0,
  qualityScore: 0,
  domainDonut: [],
  teamBars: [],
  topAssets: [],
  modules: {
    sourcesTotal: 0,
    sourcesConnected: 0,
    standardsTotal: 0,
    standardsPublished: 0,
    lineageEdges: 0,
    servicesTotal: 0,
    servicesRunning: 0,
    apiKeysActive: 0,
  },
};

export default async function DashboardPage() {
  const session = await getSession();
  const data = session ? await getDashboard(session.workspaceId) : EMPTY;
  return <DashboardClient data={data} />;
}
