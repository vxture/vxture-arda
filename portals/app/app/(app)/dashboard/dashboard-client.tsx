"use client";

import { useRouter } from "next/navigation";
import { Button, DataTable, StatusBadge, type DataTableColumn } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon, type PIconName } from "../../ui/phosphor-icon";
import { SectionHeading } from "../../ui/section-heading";
import { AreaChart, Donut, HBars, Ring } from "../../ui/charts";
import { ALERTS, ASSET_GROWTH, DOMAINS, GROWTH_MONTHS, LEVEL_TONE, QUALITY_DIMS } from "./seed";
import type { DashboardData, DashTopAsset } from "./data";

type StatTone = "blue" | "green" | "amber";

export function DashboardClient({ data }: { data: DashboardData }) {
  const t = useTranslations("dashboard");
  const router = useRouter();

  const metrics: Array<{ id: string; label: string; value: string; trend: string; tone: StatTone }> = [
    { id: "assets", label: t("metrics.assets"), value: data.total.toLocaleString(), trend: t("metrics.assetsTrend"), tone: "blue" },
    { id: "volume", label: t("metrics.volume"), value: data.volume, trend: t("metrics.volumeTrend"), tone: "blue" },
    { id: "calls", label: t("metrics.calls"), value: "1.98M", trend: t("metrics.callsTrend"), tone: "green" },
    {
      id: "compliance",
      label: t("metrics.compliance"),
      value: data.total ? data.compliance.toFixed(0) + "%" : "-",
      trend: t("metrics.complianceTrend"),
      tone: data.total && data.compliance < 95 ? "amber" : "blue",
    },
  ];

  const donut = data.domainDonut.map((d) => ({ label: t("domain." + d.key), value: d.value, color: d.color }));
  const teamBars = data.teamBars.map((b) => ({ label: t("team." + b.key), value: b.value, color: b.color }));

  const modules = data.modules;
  const moduleLinks: Array<{ key: string; icon: PIconName; href: string; value: number; sub: string }> = [
    { key: "sources", icon: "database", href: "/sources", value: modules.sourcesTotal, sub: t("module.sourcesSub", { connected: modules.sourcesConnected }) },
    { key: "standards", icon: "ruler", href: "/standards", value: modules.standardsTotal, sub: t("module.standardsSub", { published: modules.standardsPublished }) },
    { key: "lineage", icon: "tree-structure", href: "/lineage", value: modules.lineageEdges, sub: t("module.lineageSub") },
    { key: "service", icon: "broadcast", href: "/service", value: modules.servicesTotal, sub: t("module.serviceSub", { running: modules.servicesRunning }) },
    { key: "security", icon: "lock-key", href: "/security", value: modules.apiKeysActive, sub: t("module.securitySub") },
  ];

  const columns: DataTableColumn<DashTopAsset>[] = [
    {
      id: "asset",
      header: t("col.asset"),
      cell: (a) => (
        <div className="cell-asset">
          <span className="cell-asset-ico" style={{ color: a.domain ? DOMAINS[a.domain]?.color : "var(--vx-color-text-muted)" }}>
            <PIcon name={((a.domain && DOMAINS[a.domain]?.icon) || "stack") as PIconName} />
          </span>
          <div>
            <div className="cell-asset-name">{a.name}</div>
            <div className="cell-asset-code">{a.code}</div>
          </div>
        </div>
      ),
    },
    { id: "domain", header: t("col.domain"), cell: (a) => (a.domain ? t("domain." + a.domain) : "-") },
    { id: "level", header: t("col.level"), cell: (a) => <StatusBadge tone={LEVEL_TONE[a.level]}>{t("level." + a.level)}</StatusBadge> },
    { id: "quality", header: t("col.quality"), cell: () => <span className="dim">-</span> },
    { id: "subs", header: t("col.subs"), align: "right", cell: () => <span className="dim">-</span> },
  ];

  return (
    <div className="screen dash">
      <SectionHeading
        level="page"
        icon="chart-bar"
        title={t("title")}
        description={t("description")}
        action={
          <>
            <Button variant="secondary">
              <PIcon name="calendar-blank" /> {t("range")}
            </Button>
            <Button variant="secondary" size="icon" aria-label={t("refresh")}>
              <PIcon name="arrows-clockwise" />
            </Button>
            <Button>
              <PIcon name="export" /> {t("export")}
            </Button>
          </>
        }
      />

      {/* Section: core metrics */}
      <div className="ov-section">
        <SectionHeading icon="gauge" title={t("section.metricsTitle")} description={t("section.metricsSub")} />
        <div className="stat-grid">
          {metrics.map((m) => (
            <div className={"stat-card stat-tone--" + m.tone} key={m.id}>
              <span className="stat-card-label">{m.label}</span>
              <span className="stat-card-value">{m.value}</span>
              <span className="stat-card-tags">
                <em>{m.trend}</em>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Section: platform modules - the whole-platform view; each card links
          out to its own page for full detail. */}
      <div className="ov-section">
        <SectionHeading icon="app-window" title={t("section.modulesTitle")} description={t("section.modulesSub")} />
        <div className="ov-link-grid">
          {moduleLinks.map((m) => (
            <button key={m.key} className="ov-link-card" onClick={() => router.push(m.href)}>
              <span className="ov-link-card-ico">
                <PIcon name={m.icon} weight="fill" />
              </span>
              <span className="ov-link-card-body">
                <span className="ov-link-card-top">
                  <strong>{m.value.toLocaleString()}</strong>
                </span>
                <span>{t("module." + m.key)}</span>
                <small>{m.sub}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Section: asset insights - a real dashboard grid (widgets tiled in
          rows, the Datadog/Grafana pattern), not one full-width block per
          card. One heading for the theme; each widget keeps its own small
          in-card label so nothing reads as mixed together. */}
      <div className="ov-section">
        <SectionHeading icon="chart-line-up" title={t("section.insightsTitle")} description={t("section.insightsSub")} />
        <div className="dash-cols">
          <div className="dash-main">
            <div className="con-card">
              <div className="con-card-hd">
                <div>
                  <div className="con-card-heading">{t("growthTitle")}</div>
                  <div className="con-card-sub">{t("growthSub")}</div>
                </div>
                <span className="legend-inline">
                  <span className="li-dot" style={{ background: "var(--vx-color-primary)" }} />
                  {t("growthLegend")}
                </span>
              </div>
              <AreaChart data={ASSET_GROWTH} id="dashGrow" height={150} />
              <div className="chart-axis">
                {GROWTH_MONTHS.map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </div>

            <div className="con-card">
              <div className="con-card-hd">
                <div>
                  <div className="con-card-heading">{t("teamsTitle")}</div>
                  <div className="con-card-sub">{t("teamsSub")}</div>
                </div>
              </div>
              {teamBars.length ? <HBars data={teamBars} /> : <div className="dim">{t("noData")}</div>}
            </div>
          </div>

          <div className="dash-side">
            <div className="con-card">
              <div className="con-card-hd">
                <div>
                  <div className="con-card-heading">{t("domainTitle")}</div>
                  <div className="con-card-sub">{t("domainSub", { count: donut.length })}</div>
                </div>
              </div>
              {donut.length ? <Donut data={donut} caption={t("domainCaption")} /> : <div className="dim">{t("noData")}</div>}
            </div>

            <div className="con-card">
              <div className="con-card-hd">
                <div>
                  <div className="con-card-heading">{t("qualityTitle")}</div>
                  <div className="con-card-sub">{t("qualitySub")}</div>
                </div>
                {data.qualityScore > 0 && <StatusBadge tone="success">{t("qualityRating")}</StatusBadge>}
              </div>
              <div className="qm-body">
                <Ring score={data.qualityScore} color="var(--vx-color-success-600)" size={104} />
                <div className="qm-dims">
                  {QUALITY_DIMS.map((q) => (
                    <div className="qm-dim" key={q.key}>
                      <span className="qm-dim-label">{t("dim." + q.key)}</span>
                      <span className="qm-dim-track">
                        <span style={{ width: q.score + "%" }} />
                      </span>
                      <span className="qm-dim-val">{q.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section: asset detail - ranked assets + open items, side by side. */}
      <div className="ov-section">
        <SectionHeading icon="list-checks" title={t("section.detailTitle")} description={t("section.detailSub")} />
        <div className="dash-cols">
          <div className="con-card no-pad">
            <div className="con-card-hd pad">
              <div>
                <div className="con-card-heading">{t("topTitle")}</div>
                <div className="con-card-sub">{t("topSub")}</div>
              </div>
              <Button variant="link" onClick={() => router.push("/catalog")}>
                {t("topLink")}
              </Button>
            </div>
            <DataTable columns={columns} rows={data.topAssets} rowKey={(a) => a.id} onRowClick={(a) => router.push("/catalog/" + a.id)} />
          </div>

          <div className="con-card">
            <div className="con-card-hd">
              <div>
                <div className="con-card-heading">{t("alertsTitle")}</div>
                <div className="con-card-sub">{t("alertsSub", { count: ALERTS.length })}</div>
              </div>
              <StatusBadge tone="danger">{t("alertsCount")}</StatusBadge>
            </div>
            <div className="alert-list">
              {ALERTS.map((a) => (
                <button key={a.key} className="alert-item" onClick={() => router.push(a.route)}>
                  <span className="alert-ico" style={{ color: a.tone, background: `color-mix(in srgb, ${a.tone} 14%, transparent)` }}>
                    <PIcon name={a.icon} weight="fill" />
                  </span>
                  <span>
                    <span className="alert-title">{t("alert." + a.key + "Title")}</span>
                    <span className="alert-meta" style={{ display: "block" }}>
                      {t("alert." + a.key + "Meta")}
                    </span>
                  </span>
                  <PIcon className="alert-caret" name="caret-right" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
