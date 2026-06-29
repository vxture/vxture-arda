"use client";

import { useMemo, useState } from "react";
import {
  Button,
  DataTable,
  MetricGrid,
  PageHeader,
  StatusBadge,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { STANDARDS, STATUS_TONE, type Standard } from "./seed";

export default function StandardsPage() {
  const t = useTranslations("standards");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return STANDARDS;
    return STANDARDS.filter((s) => (s.name + s.id + s.ref).toLowerCase().includes(term));
  }, [q]);

  const metrics: MetricGridItem[] = [
    { id: "elements", label: t("metrics.elements"), value: "2,648" },
    { id: "codesets", label: t("metrics.codesets"), value: "312" },
    { id: "references", label: t("metrics.references"), value: "6,842", trend: t("metrics.refTrend"), tone: "positive" },
    { id: "pending", label: t("metrics.pending"), value: "14", tone: "warning" },
  ];

  const columns: DataTableColumn<Standard>[] = [
    {
      id: "name",
      header: t("col.name"),
      cell: (s) => (
        <div>
          <div className="cell-asset-name">{s.name}</div>
          <div className="cell-asset-code">{s.id}</div>
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
      cell: (s) => <StatusBadge tone={STATUS_TONE[s.status]}>{t("status." + s.status)}</StatusBadge>,
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

      <MetricGrid items={metrics} />

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
    </div>
  );
}
