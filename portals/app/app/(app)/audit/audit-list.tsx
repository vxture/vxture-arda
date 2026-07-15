"use client";

import { useMemo, useState } from "react";
import {
  DataTable,
  EmptyState,
  MetricGrid,
  StatusBadge,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { SectionHeading } from "../../ui/section-heading";
import type { AuditLogView, AuditMetrics } from "./data";

export function AuditList({ entries, metrics }: { entries: AuditLogView[]; metrics: AuditMetrics }) {
  const t = useTranslations("audit");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((e) => (e.actor + " " + e.action + " " + (e.target ?? "")).toLowerCase().includes(term));
  }, [entries, q]);

  const metricItems: MetricGridItem[] = [
    { id: "total", label: t("metrics.total"), value: metrics.total.toLocaleString() },
    { id: "platform", label: t("metrics.platform"), value: metrics.platformActions.toLocaleString() },
    { id: "last24h", label: t("metrics.last24h"), value: metrics.last24h.toLocaleString() },
  ];

  const columns: DataTableColumn<AuditLogView>[] = [
    { id: "time", header: t("col.time"), cell: (e) => <span className="mono dim">{new Date(e.createdAt).toLocaleString()}</span> },
    {
      id: "actor",
      header: t("col.actor"),
      cell: (e) =>
        e.actor === "platform" ? <StatusBadge tone="info">platform</StatusBadge> : <span className="mono">{e.actor}</span>,
    },
    { id: "action", header: t("col.action"), cell: (e) => <span className="dim-tag">{e.action}</span> },
    { id: "target", header: t("col.target"), cell: (e) => <span className="mono dim">{e.target ?? "-"}</span> },
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="list-checks" title={t("title")} description={t("description")} />

      <MetricGrid items={metricItems} />

      {entries.length === 0 ? (
        <EmptyState
          title={
            <span className="app-empty-title">
              <PIcon name="list-checks" /> {t("emptyTitle")}
            </span>
          }
          description={t("emptyDesc")}
        />
      ) : (
        <div className="con-card no-pad">
          <div className="con-card-hd pad">
            <div className="con-card-heading">{t("listTitle")}</div>
            <label className="fb-search" style={{ maxWidth: 280 }}>
              <PIcon name="magnifying-glass" />
              <input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          <DataTable columns={columns} rows={list} rowKey={(e) => e.id} />
        </div>
      )}
    </div>
  );
}
