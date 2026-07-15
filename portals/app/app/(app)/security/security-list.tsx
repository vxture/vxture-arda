"use client";

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
import { Donut } from "../../ui/charts";
import { LEVEL_TONE, REQUEST_TONE, REQUESTS, type ShareRequest } from "./seed";
import type { SecurityData } from "./data";

export function SecurityList({ data }: { data: SecurityData }) {
  const t = useTranslations("security");

  const metrics: MetricGridItem[] = [
    { id: "coverage", label: t("metrics.coverage"), value: data.total ? data.coverage.toFixed(1) + "%" : "-", tone: "positive" },
    { id: "masking", label: t("metrics.masking"), value: "486" },
    { id: "core", label: t("metrics.core"), value: data.coreCount.toLocaleString(), tone: "danger" },
    { id: "blocked", label: t("metrics.blocked"), value: "23", tone: "warning" },
  ];

  const donut = data.dist.map((d) => ({ label: t("level." + d.key), value: d.value, color: d.color }));
  const pendingCount = REQUESTS.filter((r) => r.status === "pending").length;

  const columns: DataTableColumn<ShareRequest>[] = [
    { id: "who", header: t("col.who"), cell: (r) => <span className="cell-asset-name">{r.who}</span> },
    { id: "asset", header: t("col.asset"), cell: (r) => r.asset },
    {
      id: "level",
      header: t("col.level"),
      cell: (r) => <StatusBadge tone={LEVEL_TONE[r.level]}>{t("level." + r.level)}</StatusBadge>,
    },
    { id: "time", header: t("col.time"), cell: (r) => <span className="dim">{r.time}</span> },
    {
      id: "status",
      header: t("col.status"),
      cell: (r) => <StatusBadge tone={REQUEST_TONE[r.status]}>{t("status." + r.status)}</StatusBadge>,
    },
  ];

  return (
    <div className="screen">
      <SectionHeading
        level="page"
        icon="lock-key"
        title={t("title")}
        description={t("description")}
        action={
          <>
            <Button variant="secondary">
              <PIcon name="shield" /> {t("template")}
            </Button>
            <Button>
              <PIcon name="scan" /> {t("classify")}
            </Button>
          </>
        }
      />

      <MetricGrid items={metrics} />

      <div className="dash-cols">
        <div className="con-card">
          <div className="con-card-hd">
            <div className="con-card-heading">{t("distTitle")}</div>
          </div>
          {data.total ? (
            <Donut data={donut} caption={t("distCaption")} />
          ) : (
            <div className="empty-inline">
              <PIcon name="shield" />
              <p>{t("distEmpty")}</p>
            </div>
          )}
        </div>
        <div className="con-card no-pad">
          <div className="con-card-hd pad">
            <div>
              <div className="con-card-heading">{t("reqTitle")}</div>
              <div className="con-card-sub">{t("reqSub")}</div>
            </div>
            <StatusBadge tone="warning">{t("reqPending", { count: pendingCount })}</StatusBadge>
          </div>
          <DataTable columns={columns} rows={REQUESTS} rowKey={(r) => r.who + r.asset} />
        </div>
      </div>

      {data.total > 0 && (
        <div className="level-strip">
          {data.dist.map((d) => (
            <div className="level-card" key={d.key} style={{ borderTopColor: d.color }}>
              <div className="lc-top">
                <span className="lc-dot" style={{ background: d.color }} />
                <span className="lc-name">{t("level." + d.key)}</span>
              </div>
              <div className="lc-val">{d.value.toLocaleString()}</div>
              <div className="lc-sub">{t("assetsUnit")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
