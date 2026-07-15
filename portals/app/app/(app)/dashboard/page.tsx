import { getSession } from "../../auth/lib/session";
import { getDashboard, type DashboardData, type Period } from "./data";
import { DashboardClient } from "./dashboard-client";

// Server component: load workspace aggregates (totals, domain/team distribution,
// top assets, quality) from the DB. Reads cookies, so the route is dynamic.
export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["month", "quarter", "year", "all"];

function parsePeriod(value: string | undefined, fallback: Period): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : fallback;
}

function empty(period: Period): DashboardData {
  return {
    period,
    datasetCount: 0,
    capacityValue: "0",
    capacityUnit: "B",
    capacityNewInPeriod: "0B",
    datasetNewInPeriod: 0,
    serviceCount: 0,
    serviceNewInPeriod: 0,
    qualityScore: 0,
    qualityRunsInPeriod: 0,
    domainDonut: [],
    topAssets: [],
    servicesRunning: 0,
    servicesList: [],
    standardsTotal: 0,
    standardsPublished: 0,
    standardsList: [],
    apiKeysActive: 0,
    policiesEnabled: 0,
    businessContribution: [],
    teamContribution: [],
    sourcesTotal: 0,
    sourcesConnected: 0,
    sourcesList: [],
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; bizPeriod?: string; teamPeriod?: string; extPeriod?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const period = parsePeriod(params.period, "month");

  const data = session ? await getDashboard(session.workspaceId, period) : empty(period);

  // Section 7 (data aggregation) sub-blocks default to the page period but
  // can be switched independently - refetch only the pieces that differ.
  const bizPeriod = parsePeriod(params.bizPeriod, period);
  const teamPeriod = parsePeriod(params.teamPeriod, period);
  const extPeriod = parsePeriod(params.extPeriod, period);

  const [bizData, teamData, extData] = session
    ? await Promise.all([
        bizPeriod === period ? null : getDashboard(session.workspaceId, bizPeriod),
        teamPeriod === period ? null : getDashboard(session.workspaceId, teamPeriod),
        extPeriod === period ? null : getDashboard(session.workspaceId, extPeriod),
      ])
    : [null, null, null];

  if (bizData) data.businessContribution = bizData.businessContribution;
  if (teamData) data.teamContribution = teamData.teamContribution;
  if (extData) {
    data.sourcesTotal = extData.sourcesTotal;
    data.sourcesConnected = extData.sourcesConnected;
    data.sourcesList = extData.sourcesList;
  }

  return (
    <DashboardClient
      data={data}
      periods={{ main: period, biz: bizPeriod, team: teamPeriod, ext: extPeriod }}
      rawParams={params}
    />
  );
}
