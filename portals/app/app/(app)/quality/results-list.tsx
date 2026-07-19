"use client";

import { DataTable, MetricGrid, StatusBadge, type DataTableColumn, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { SectionHeading } from "../../ui/section-heading";
import type { QualityResultView } from "./outcomes-data";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  pass: "success",
  warn: "warning",
  fail: "danger",
};

function fmt(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

/** Quality check-results feed (biz-433 result ring, read-only). */
export function ResultsList({ rows }: { rows: QualityResultView[] }) {
  const t = useTranslations("quality");

  const pass = rows.filter((r) => r.status === "pass").length;
  const warn = rows.filter((r) => r.status === "warn").length;
  const fail = rows.filter((r) => r.status === "fail").length;

  const metrics: MetricGridItem[] = [
    { id: "total", label: t("r.mTotal"), value: rows.length.toLocaleString() },
    { id: "pass", label: t("r.mPass"), value: pass.toLocaleString(), tone: "positive" },
    { id: "warn", label: t("r.mWarn"), value: warn.toLocaleString(), tone: warn ? "warning" : "default" },
    { id: "fail", label: t("r.mFail"), value: fail.toLocaleString(), tone: fail ? "danger" : "default" },
  ];

  const columns: DataTableColumn<QualityResultView>[] = [
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
    {
      id: "status",
      header: t("col.status"),
      cell: (r) => <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"}>{t("status." + r.status)}</StatusBadge>,
    },
    { id: "score", header: t("col.score"), align: "right", cell: (r) => (r.score == null ? "-" : r.score + "%") },
    { id: "issues", header: t("col.issues"), align: "right", cell: (r) => r.issues.toLocaleString() },
    { id: "ranAt", header: t("col.ranAt"), cell: (r) => <span className="dim">{fmt(r.ranAt)}</span> },
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="list-checks" title={t("r.title")} description={t("r.desc")} />
      <MetricGrid items={metrics} />
      <div className="con-card no-pad">
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty={t("r.empty")} />
      </div>
    </div>
  );
}
