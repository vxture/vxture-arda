"use client";

import { DataTable, MetricGrid, StatusBadge, type DataTableColumn, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { SectionHeading } from "../../ui/section-heading";
import type { SourceHealth, SourceHealthRow } from "./health-data";

const BUCKET_TONE: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
  fresh: "success",
  aging: "info",
  stale: "warning",
  failed: "danger",
  never: "neutral",
};

function fmtAge(hours: number | null): string {
  if (hours == null) return "-";
  if (hours < 24) return hours + "h";
  return Math.round(hours / 24) + "d";
}

/** Source freshness health: who synced recently, who is stale / failed.
 *  Read-only over DataSource.status + lastSyncedAt. */
export function HealthView({ health }: { health: SourceHealth }) {
  const t = useTranslations("srcHealth");

  const metrics: MetricGridItem[] = [
    { id: "total", label: t("mTotal"), value: health.total.toLocaleString() },
    { id: "fresh", label: t("mFresh"), value: health.fresh.toLocaleString(), tone: "positive" },
    { id: "stale", label: t("mStale"), value: (health.stale + health.aging).toLocaleString(), tone: health.stale ? "warning" : "default" },
    { id: "failed", label: t("mFailed"), value: health.failed.toLocaleString(), tone: health.failed ? "danger" : "default" },
  ];

  const columns: DataTableColumn<SourceHealthRow>[] = [
    { id: "name", header: t("cName"), cell: (r) => <span className="cell-asset-name">{r.name}</span> },
    { id: "type", header: t("cType"), cell: (r) => <span className="dim-tag">{r.type}</span> },
    { id: "status", header: t("cStatus"), cell: (r) => <StatusBadge tone={BUCKET_TONE[r.bucket]}>{t("bucket." + r.bucket)}</StatusBadge> },
    { id: "synced", header: t("cSynced"), cell: (r) => <span className="dim">{r.lastSyncedAt ? r.lastSyncedAt.slice(0, 16).replace("T", " ") : t("bucket.never")}</span> },
    { id: "age", header: t("cAge"), align: "right", cell: (r) => fmtAge(r.ageHours) },
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="pulse" title={t("title")} description={t("desc")} />
      <MetricGrid items={metrics} />
      <div className="con-card no-pad">
        <DataTable columns={columns} rows={health.sources} rowKey={(r) => r.id} empty={t("empty")} />
      </div>
    </div>
  );
}
