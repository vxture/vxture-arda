import { getSession } from "../../../auth/lib/session";
import { getQualityReport } from "../outcomes-data";
import { ReportView } from "../report-view";

// Server component: aggregate quality report for the workspace.
export const dynamic = "force-dynamic";

export default async function QualityReportPage() {
  const session = await getSession();
  const report = session
    ? await getQualityReport(session.workspaceId)
    : { totalRules: 0, score: null, passRate: null, distribution: { pass: 0, warn: 0, fail: 0 }, sixDim: [], byDomain: [], lastRunAt: null };
  return <ReportView report={report} />;
}
