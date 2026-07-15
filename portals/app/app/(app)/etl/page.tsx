"use client";

import { useMemo, useState } from "react";
import {
  Button,
  DataTable,
  MetricGrid,
  StatusBadge,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { SectionHeading } from "../../ui/section-heading";
import { PIPELINES, STATUS_META, type PipelineRow } from "./seed";

type SegKey = "all" | "running" | "issues";
const SEGS: SegKey[] = ["all", "running", "issues"];

export default function EtlPage() {
  const t = useTranslations("etl");
  const [seg, setSeg] = useState<SegKey>("all");

  const rows = useMemo(() => {
    if (seg === "running") return PIPELINES.filter((p) => p.status === "running");
    if (seg === "issues") return PIPELINES.filter((p) => p.status === "warning" || p.status === "failed");
    return PIPELINES;
  }, [seg]);

  const metricItems: MetricGridItem[] = [
    { id: "jobs", label: t("metrics.jobs"), value: "386" },
    { id: "success", label: t("metrics.success"), value: "98.2%", tone: "success" },
    { id: "realtime", label: t("metrics.realtime"), value: "42" },
    { id: "volume", label: t("metrics.volume"), value: "8.4" },
  ];

  const columns: DataTableColumn<PipelineRow>[] = [
    {
      id: "name",
      header: t("col.task"),
      cell: (p) => (
        <div>
          <div className="cell-asset-name">{t("rows." + p.key + ".name")}</div>
          <div className="cell-asset-code">{p.id}</div>
        </div>
      ),
    },
    { id: "source", header: t("col.source"), cell: (p) => <span className="dim">{t("rows." + p.key + ".source")}</span> },
    { id: "target", header: t("col.target"), cell: (p) => <span className="mono dim">{t("rows." + p.key + ".target")}</span> },
    {
      id: "status",
      header: t("col.status"),
      cell: (p) => <StatusBadge tone={STATUS_META[p.status].tone}>{t("status." + p.status)}</StatusBadge>,
    },
    { id: "rows", header: t("col.rows"), align: "right", cell: (p) => p.rows },
    { id: "dur", header: t("col.dur"), cell: (p) => <span className="dim">{p.dur}</span> },
    { id: "schedule", header: t("col.schedule"), cell: (p) => <span className="dim">{t("schedule." + p.schedule)}</span> },
    {
      id: "actions",
      header: "",
      cell: () => (
        <div className="row-actions">
          <button className="ra-btn" aria-label={t("run")}>
            <PIcon name="play" />
          </button>
          <button className="ra-btn" aria-label={t("logs")}>
            <PIcon name="book-open" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="screen">
      <SectionHeading
        level="page"
        icon="flow-arrow"
        title={t("title")}
        description={t("description")}
        action={
          <>
            <Button variant="secondary">
              <PIcon name="flow-arrow" /> {t("orchestrate")}
            </Button>
            <Button>
              <PIcon name="plus" /> {t("newJob")}
            </Button>
          </>
        }
      />

      <MetricGrid items={metricItems} />

      <div className="con-card no-pad">
        <div className="con-card-hd pad">
          <div>
            <div className="con-card-heading">{t("opsTitle")}</div>
            <div className="con-card-sub">{t("opsSub")}</div>
          </div>
          <div className="seg-tabs" role="tablist" aria-label={t("opsTitle")}>
            {SEGS.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={seg === s}
                className={"seg" + (seg === s ? " active" : "")}
                onClick={() => setSeg(s)}
              >
                {t("seg." + s)}
              </button>
            ))}
          </div>
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} />
      </div>
    </div>
  );
}
