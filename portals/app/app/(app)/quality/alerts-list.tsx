"use client";

import { DataTable, MetricGrid, StatusBadge, type DataTableColumn, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { SectionHeading } from "../../ui/section-heading";
import type { QualityResultView } from "./outcomes-data";

const STATUS_TONE: Record<string, "warning" | "danger"> = { warn: "warning", fail: "danger" };

function fmt(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

/** Quality alert feed: warn+fail results only (biz-433 monitoring, read-only). */
export function AlertsList({ rows }: { rows: QualityResultView[] }) {
  const t = useTranslations("quality");

  const critical = rows.filter((r) => r.status === "fail").length;
  const warning = rows.filter((r) => r.status === "warn").length;
  const datasets = new Set(rows.map((r) => r.dataset)).size;

  const metrics: MetricGridItem[] = [
    { id: "open", label: t("a.mOpen"), value: rows.length.toLocaleString(), tone: rows.length ? "warning" : "positive" },
    { id: "critical", label: t("a.mCritical"), value: critical.toLocaleString(), tone: critical ? "danger" : "default" },
    { id: "warning", label: t("a.mWarning"), value: warning.toLocaleString(), tone: warning ? "warning" : "default" },
    { id: "datasets", label: t("a.mDatasets"), value: datasets.toLocaleString() },
  ];

  const columns: DataTableColumn<QualityResultView>[] = [
    {
      id: "status",
      header: t("col.status"),
      cell: (r) => <StatusBadge tone={STATUS_TONE[r.status] ?? "warning"}>{t("status." + r.status)}</StatusBadge>,
    },
    {
      id: "rule",
      header: t("col.rule"),
      cell: (r) => (
        <div>
          <div className="cell-asset-name">{r.ruleName}</div>
          <div className="cell-asset-code">{r.ruleCode}</div>
        </div>
      ),
    },
    { id: "target", header: t("col.target"), cell: (r) => r.dataset },
    { id: "dim", header: t("col.dim"), cell: (r) => <span className="dim-tag">{t("dim." + r.dim)}</span> },
    { id: "issues", header: t("col.issues"), align: "right", cell: (r) => r.issues.toLocaleString() },
    { id: "ranAt", header: t("col.ranAt"), cell: (r) => <span className="dim">{fmt(r.ranAt)}</span> },
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="warning" title={t("a.title")} description={t("a.desc")} />
      <MetricGrid items={metrics} />
      <div className="con-card no-pad">
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty={t("a.empty")} />
      </div>
    </div>
  );
}
