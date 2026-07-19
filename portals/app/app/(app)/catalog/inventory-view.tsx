"use client";

import { DataTable, MetricGrid, StatusBadge, type DataTableColumn, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { SectionHeading } from "../../ui/section-heading";
import { HBars } from "../../ui/charts";
import { LEVEL_TONE } from "./seed";
import type { AssetInventory, CountRow } from "./inventory-data";

const BAR = "var(--vx-color-primary)";

/** Asset inventory ("how many"): distribution of datasets by domain / team /
 *  classification, read-only aggregate over Dataset. */
export function InventoryView({ inv }: { inv: AssetInventory }) {
  const t = useTranslations("inventory");
  const tl = useTranslations("quality");

  const metrics: MetricGridItem[] = [
    { id: "total", label: t("mTotal"), value: inv.total.toLocaleString() },
    { id: "bytes", label: t("mBytes"), value: inv.totalBytes },
    { id: "owner", label: t("mOwner"), value: inv.withOwner.toLocaleString() },
    { id: "golden", label: t("mGolden"), value: inv.golden.toLocaleString() },
  ];

  const domainBars = inv.byDomain.map((r: CountRow) => ({ label: r.key || t("none"), value: r.count, color: BAR }));
  const teamBars = inv.byTeam.map((r: CountRow) => ({ label: r.key || t("none"), value: r.count, color: BAR }));

  const levelCols: DataTableColumn<{ level: string; count: number }>[] = [
    { id: "level", header: t("cLevel"), cell: (r) => <StatusBadge tone={LEVEL_TONE[r.level as never]}>{tl("level." + r.level)}</StatusBadge> },
    { id: "count", header: t("cCount"), align: "right", cell: (r) => r.count.toLocaleString() },
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="chart-bar" title={t("title")} description={t("desc")} />
      <MetricGrid items={metrics} />
      <div className="dash-cols">
        <div className="con-card">
          <div className="con-card-hd">
            <div className="con-card-heading">{t("byDomain")}</div>
          </div>
          {domainBars.length ? <HBars data={domainBars} /> : <p className="dim">{t("empty")}</p>}
        </div>
        <div className="con-card">
          <div className="con-card-hd">
            <div className="con-card-heading">{t("byTeam")}</div>
          </div>
          {teamBars.length ? <HBars data={teamBars} /> : <p className="dim">{t("empty")}</p>}
        </div>
      </div>
      <div className="con-card no-pad">
        <div className="con-card-hd pad">
          <div className="con-card-heading">{t("byLevel")}</div>
        </div>
        <DataTable columns={levelCols} rows={inv.byLevel} rowKey={(r) => r.level} />
      </div>
    </div>
  );
}
