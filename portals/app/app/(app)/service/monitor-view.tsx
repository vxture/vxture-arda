"use client";

import { DataTable, MetricGrid, type DataTableColumn, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { SectionHeading } from "../../ui/section-heading";
import { HBars } from "../../ui/charts";
import type { ServiceCallRow, ServiceMonitor } from "./monitor-data";

const BAR = "var(--vx-color-primary)";

/** Service invocation monitoring: call volume over the service.access audit
 *  trail (real telemetry is future). Read-only. */
export function MonitorView({ mon }: { mon: ServiceMonitor }) {
  const t = useTranslations("svcMonitor");

  const metrics: MetricGridItem[] = [
    { id: "total", label: t("mTotal"), value: mon.totalCalls.toLocaleString() },
    { id: "services", label: t("mServices"), value: mon.services.toLocaleString() },
    { id: "window", label: t("mWindow"), value: mon.windowCalls.toLocaleString() },
  ];

  const bars = mon.byService.map((s) => ({ label: s.name, value: s.calls, color: BAR }));

  const columns: DataTableColumn<ServiceCallRow>[] = [
    { id: "service", header: t("cService"), cell: (r) => <span className="cell-asset-name">{r.service}</span> },
    { id: "actor", header: t("cActor"), cell: (r) => <span className="dim">{r.actor}</span> },
    { id: "at", header: t("cAt"), cell: (r) => <span className="dim">{r.at.slice(0, 16).replace("T", " ")}</span> },
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="pulse" title={t("title")} description={t("desc")} />
      <MetricGrid items={metrics} />
      <div className="con-card">
        <div className="con-card-hd">
          <div className="con-card-heading">{t("byService")}</div>
        </div>
        {bars.length ? <HBars data={bars} /> : <p className="dim">{t("empty")}</p>}
      </div>
      <div className="con-card no-pad">
        <div className="con-card-hd pad">
          <div className="con-card-heading">{t("recentTitle")}</div>
        </div>
        <DataTable columns={columns} rows={mon.recent} rowKey={(r) => r.service + r.at + r.actor} empty={t("empty")} />
      </div>
    </div>
  );
}
