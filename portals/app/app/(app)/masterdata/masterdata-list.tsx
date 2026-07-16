"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Button,
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
import { setGoldenRecord } from "../catalog/actions";
import type { MasterDataMetrics, MasterDataView } from "./data";

export function MasterDataList({
  records,
  metrics,
  isAdmin = false,
}: {
  records: MasterDataView[];
  metrics: MasterDataMetrics;
  isAdmin?: boolean;
}) {
  const t = useTranslations("masterdata");
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [unmarkingId, setUnmarkingId] = useState<string | null>(null);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return records;
    return records.filter((r) => (r.name + r.code + (r.domain ?? "")).toLowerCase().includes(term));
  }, [records, q]);

  const unmark = (id: string) => {
    setUnmarkingId(id);
    startTransition(async () => {
      await setGoldenRecord(id, false);
    });
  };

  const metricItems: MetricGridItem[] = [
    { id: "total", label: t("metrics.total"), value: metrics.total.toLocaleString() },
    { id: "domains", label: t("metrics.domains"), value: metrics.domains.toLocaleString() },
    { id: "standardsLinked", label: t("metrics.standardsLinked"), value: metrics.standardsLinked.toLocaleString() },
  ];

  const columns: DataTableColumn<MasterDataView>[] = [
    {
      id: "name",
      header: t("col.name"),
      cell: (r) => (
        <div>
          <div className="cell-asset-name">{r.name}</div>
          <div className="cell-asset-code">{r.code}</div>
        </div>
      ),
    },
    { id: "domain", header: t("col.domain"), cell: (r) => r.domain ?? "-" },
    { id: "team", header: t("col.team"), cell: (r) => r.team ?? "-" },
    { id: "type", header: t("col.type"), cell: (r) => <span className="dim-tag">{r.type}</span> },
    {
      id: "standards",
      header: t("col.standards"),
      align: "right",
      cell: (r) =>
        r.standardsCount > 0 ? (
          <StatusBadge tone="success">{r.standardsCount}</StatusBadge>
        ) : (
          <span className="dim">0</span>
        ),
    },
    { id: "updated", header: t("col.updated"), cell: (r) => <span className="dim">{r.updated}</span> },
    ...(isAdmin
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            cell: (r: MasterDataView) => (
              <Button
                variant="secondary"
                disabled={pending && unmarkingId === r.id}
                onClick={() => unmark(r.id)}
              >
                <PIcon name="crown-simple" /> {t("unmark")}
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="crown-simple" title={t("title")} description={t("description")} />

      <MetricGrid items={metricItems} />

      {records.length === 0 ? (
        <EmptyState
          title={
            <span className="app-empty-title">
              <PIcon name="crown-simple" /> {t("emptyTitle")}
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
          <DataTable columns={columns} rows={list} rowKey={(r) => r.id} />
        </div>
      )}
    </div>
  );
}
