"use client";

import { DataTable, MetricGrid, StatusBadge, type DataTableColumn, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { SectionHeading } from "../../ui/section-heading";
import { HBars } from "../../ui/charts";
import { LEVEL_TONE } from "../catalog/seed";
import type { CapacityProfile } from "./capacity-data";

const BAR = "var(--vx-color-primary)";

// Client-local byte formatter (mirrors capacity-data's) - importing the value
// from capacity-data would drag its prisma import into the client bundle.
function formatBytes(n: number): string {
  if (n >= 1 << 30) return (n / (1 << 30)).toFixed(1) + " GB";
  if (n >= 1 << 20) return (n / (1 << 20)).toFixed(1) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

/** Capacity profile: storage occupancy by domain / level / dataset. Quota
 *  water-line lives on the vxture platform (deep link), not computed here. */
export function CapacityView({ cap }: { cap: CapacityProfile }) {
  const t = useTranslations("capacity");
  const tl = useTranslations("quality");

  const avg = cap.datasetCount ? cap.totalBytesRaw / cap.datasetCount : 0;

  const metrics: MetricGridItem[] = [
    { id: "total", label: t("mTotal"), value: cap.totalBytes },
    { id: "datasets", label: t("mDatasets"), value: cap.datasetCount.toLocaleString() },
    { id: "avg", label: t("mAvg"), value: formatBytes(Math.round(avg)) },
    { id: "largest", label: t("mLargest"), value: cap.top[0] ? formatBytes(cap.top[0].bytes) : "-" },
  ];

  const domainBars = cap.byDomain.map((r) => ({
    label: r.key || t("none"),
    value: cap.totalBytesRaw ? Math.round((r.bytes / cap.totalBytesRaw) * 100) : 0,
    color: BAR,
  }));

  const topCols: DataTableColumn<{ name: string; bytes: number; pct: number }>[] = [
    { id: "name", header: t("cDataset"), cell: (r) => r.name },
    { id: "size", header: t("cSize"), align: "right", cell: (r) => formatBytes(r.bytes) },
    { id: "share", header: t("cShare"), align: "right", cell: (r) => r.pct + "%" },
  ];

  const levelCols: DataTableColumn<{ level: string; bytes: number }>[] = [
    { id: "level", header: t("cLevel"), cell: (r) => <StatusBadge tone={LEVEL_TONE[r.level as never]}>{tl("level." + r.level)}</StatusBadge> },
    { id: "bytes", header: t("cSize"), align: "right", cell: (r) => formatBytes(r.bytes) },
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="hard-drives" title={t("title")} description={t("desc")} />
      <MetricGrid items={metrics} />
      <p className="dim" style={{ fontSize: 13 }}>
        {t("quotaNote")}
      </p>
      <div className="dash-cols">
        <div className="con-card">
          <div className="con-card-hd">
            <div className="con-card-heading">{t("byDomain")}</div>
          </div>
          {domainBars.length ? <HBars data={domainBars} /> : <p className="dim">{t("empty")}</p>}
        </div>
        <div className="con-card no-pad">
          <div className="con-card-hd pad">
            <div className="con-card-heading">{t("byLevel")}</div>
          </div>
          <DataTable columns={levelCols} rows={cap.byLevel} rowKey={(r) => r.level} />
        </div>
      </div>
      <div className="con-card no-pad">
        <div className="con-card-hd pad">
          <div className="con-card-heading">{t("topTitle")}</div>
        </div>
        <DataTable columns={topCols} rows={cap.top} rowKey={(r) => r.name} empty={t("empty")} />
      </div>
    </div>
  );
}
