"use client";

import { useMemo, useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  MetricGrid,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { STATUS_TONE } from "./seed";
import type { StandardsMetrics, StandardView } from "./data";

export function StandardsList({ standards, metrics }: { standards: StandardView[]; metrics: StandardsMetrics }) {
  const t = useTranslations("standards");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return standards;
    return standards.filter((s) => (s.name + s.code + s.ref).toLowerCase().includes(term));
  }, [standards, q]);

  const metricItems: MetricGridItem[] = [
    { id: "elements", label: t("metrics.elements"), value: metrics.elements.toLocaleString() },
    { id: "codesets", label: t("metrics.codesets"), value: metrics.codesets.toLocaleString() },
    { id: "references", label: t("metrics.references"), value: metrics.references.toLocaleString() },
    { id: "pending", label: t("metrics.pending"), value: metrics.pending.toLocaleString(), tone: metrics.pending ? "warning" : "default" },
  ];

  const columns: DataTableColumn<StandardView>[] = [
    {
      id: "name",
      header: t("col.name"),
      cell: (s) => (
        <div>
          <div className="cell-asset-name">{s.name}</div>
          <div className="cell-asset-code">{s.code}</div>
        </div>
      ),
    },
    { id: "type", header: t("col.type"), cell: (s) => <span className="dim-tag">{t("type." + s.type)}</span> },
    { id: "ref", header: t("col.ref"), cell: (s) => <span className="mono dim">{s.ref}</span> },
    { id: "items", header: t("col.items"), align: "right", cell: (s) => s.items.toLocaleString() },
    { id: "usage", header: t("col.usage"), align: "right", cell: (s) => s.usage.toLocaleString() },
    {
      id: "status",
      header: t("col.status"),
      cell: (s) => <StatusBadge tone={STATUS_TONE[s.status] ?? "neutral"}>{t("status." + s.status)}</StatusBadge>,
    },
  ];

  return (
    <div className="screen">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button variant="secondary">
              <PIcon name="book-open" /> {t("docs")}
            </Button>
            <Button>
              <PIcon name="plus" /> {t("newStandard")}
            </Button>
          </>
        }
      />

      <MetricGrid items={metricItems} />

      {standards.length === 0 ? (
        <EmptyState
          title={
            <span className="app-empty-title">
              <PIcon name="ruler" /> {t("emptyTitle")}
            </span>
          }
          description={t("emptyDesc")}
        />
      ) : (
        <div className="con-card no-pad">
          <div className="con-card-hd pad">
            <div className="con-card-heading">{t("libraryTitle")}</div>
            <label className="fb-search" style={{ maxWidth: 280 }}>
              <PIcon name="magnifying-glass" />
              <input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
          <DataTable columns={columns} rows={list} rowKey={(s) => s.id} />
        </div>
      )}
    </div>
  );
}
