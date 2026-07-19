"use client";

import { MetricGrid, StatusBadge, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { SectionHeading } from "../../ui/section-heading";
import { Donut, HBars, Radar } from "../../ui/charts";
import { passColor } from "./seed";
import type { QualityReport } from "./outcomes-data";

/** Aggregate quality report: six-dimension radar, result distribution, and
 *  per-subject-domain quality - all derived from the latest result per rule. */
export function ReportView({ report }: { report: QualityReport }) {
  const t = useTranslations("quality");

  const metrics: MetricGridItem[] = [
    { id: "score", label: t("rep.mScore"), value: report.score == null ? "-" : report.score.toFixed(1), tone: "positive" },
    { id: "rules", label: t("rep.mRules"), value: report.totalRules.toLocaleString() },
    { id: "passRate", label: t("rep.mPassRate"), value: report.passRate == null ? "-" : report.passRate + "%" },
    {
      id: "fail",
      label: t("rep.mFail"),
      value: report.distribution.fail.toLocaleString(),
      tone: report.distribution.fail ? "danger" : "default",
    },
  ];

  const distData = [
    { label: t("status.pass"), value: report.distribution.pass, color: "var(--vx-color-success-500)" },
    { label: t("status.warn"), value: report.distribution.warn, color: "var(--vx-color-warning-500)" },
    { label: t("status.fail"), value: report.distribution.fail, color: "var(--vx-color-danger-500)" },
  ].filter((d) => d.value > 0);

  const domainBars = report.byDomain.map((d) => ({
    label: d.domain || t("rep.noDomain"),
    value: Math.round(d.score),
    color: passColor(d.score),
  }));

  return (
    <div className="screen">
      <SectionHeading level="page" icon="chart-bar" title={t("rep.title")} description={t("rep.desc")} />
      <MetricGrid items={metrics} />

      <div className="dash-cols">
        <div className="con-card">
          <div className="con-card-hd">
            <div className="con-card-heading">{t("rep.sixDimTitle")}</div>
          </div>
          <div className="q-radar-center">
            {report.sixDim.length > 0 ? (
              <Radar data={report.sixDim.map((d) => ({ name: t("dim." + d.key), score: d.score }))} size={230} />
            ) : (
              <p className="dim">{t("rep.empty")}</p>
            )}
          </div>
        </div>
        <div className="con-card">
          <div className="con-card-hd">
            <div className="con-card-heading">{t("rep.distTitle")}</div>
          </div>
          {distData.length > 0 ? (
            <Donut data={distData} size={200} caption={t("rep.distCaption")} />
          ) : (
            <p className="dim">{t("rep.empty")}</p>
          )}
        </div>
      </div>

      <div className="con-card">
        <div className="con-card-hd">
          <div className="con-card-heading">{t("rep.byDomainTitle")}</div>
          {report.lastRunAt && <StatusBadge tone="info">{report.lastRunAt.slice(0, 10)}</StatusBadge>}
        </div>
        {domainBars.length > 0 ? <HBars data={domainBars} /> : <p className="dim">{t("rep.empty")}</p>}
      </div>
    </div>
  );
}
