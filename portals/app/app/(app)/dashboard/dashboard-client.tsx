"use client";

import { useRouter } from "next/navigation";
import { Button, DataTable, StatusBadge, type DataTableColumn } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon, type PIconName } from "../../ui/phosphor-icon";
import { SectionHeading } from "../../ui/section-heading";
import { PeriodSwitch, type PeriodKey } from "../../ui/period-switch";
import { AreaChart, Donut, HBars, Ring } from "../../ui/charts";
import { ALERTS, ASSET_GROWTH, DOMAINS, GROWTH_MONTHS, LEVEL_TONE, QUALITY_DIMS } from "./seed";
import type { DashboardData, DashTopAsset } from "./data";

type StatTone = "blue" | "green" | "amber";

export function DashboardClient({
  data,
  periods,
  rawParams,
}: {
  data: DashboardData;
  periods: { main: PeriodKey; biz: PeriodKey; team: PeriodKey; ext: PeriodKey };
  rawParams: { period?: string; bizPeriod?: string; teamPeriod?: string; extPeriod?: string };
}) {
  const t = useTranslations("dashboard");
  const router = useRouter();

  const newInPeriod = (count: number): string[] =>
    periods.main === "all" ? [] : [t("metrics.newInPeriod", { count, period: t("period." + periods.main) })];

  const metrics: Array<{ id: string; label: string; value: string; unit?: string; tags: string[]; tone: StatTone; icon: PIconName }> = [
    {
      id: "assets",
      label: t("metrics.assets"),
      value: data.datasetCount.toLocaleString(),
      unit: t("metrics.unitCount"),
      tags: newInPeriod(data.datasetNewInPeriod),
      tone: "blue",
      icon: "stack",
    },
    {
      id: "capacity",
      label: t("metrics.capacity"),
      value: data.capacityValue,
      unit: data.capacityUnit,
      tags: periods.main === "all" ? [] : [t("metrics.capacityNew", { value: data.capacityNewInPeriod })],
      tone: "blue",
      icon: "database",
    },
    {
      id: "services",
      label: t("metrics.services"),
      value: data.serviceCount.toLocaleString(),
      unit: t("metrics.unitCount"),
      tags: newInPeriod(data.serviceNewInPeriod),
      tone: "green",
      icon: "broadcast",
    },
    {
      id: "quality",
      label: t("metrics.quality"),
      value: data.qualityScore ? data.qualityScore.toFixed(0) : "-",
      unit: data.qualityScore ? "%" : undefined,
      tags: periods.main === "all" || !data.qualityRunsInPeriod ? [] : [t("metrics.qualityRuns", { count: data.qualityRunsInPeriod })],
      tone: data.qualityScore && data.qualityScore < 95 ? "amber" : "blue",
      icon: "seal-check",
    },
  ];

  const domainDonut = data.domainDonut.map((d) => ({ label: t("domain." + d.key), value: d.value, color: d.color }));
  const businessDonut = data.businessContribution.map((d) => ({ label: t("domain." + d.key), value: d.value, color: d.color }));
  const teamBars = data.teamContribution.map((b) => ({ label: t("team." + b.key), value: b.value, color: b.color }));

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
        action={<PeriodSwitch paramKey="period" value={periods.main} scope="main" rawParams={rawParams} />}
      />

      {/* 核心指标: no heading of its own - it reads as the page title's own
          overall stats, so it's just the period switch (on the title) + the
          4 stat cards, sitting directly under the title with no separate
          section label. */}
      <div className="stat-grid">
        {metrics.map((m) => (
          <div className={"stat-card stat-tone--" + m.tone} key={m.id}>
            <PIcon className="stat-card-art" name={m.icon} weight="fill" aria-hidden />
            <div className="stat-card-top">
              <span className="stat-card-dot" aria-hidden />
              <span className="stat-card-label">{m.label}</span>
            </div>
            <div className="stat-card-value-row">
              <span className="stat-card-value">{m.value}</span>
              {m.unit && <small className="stat-card-unit">{m.unit}</small>}
              <span className="stat-card-tags">
                {m.tags.map((tag) => (
                  <em key={tag}>{tag}</em>
                ))}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. 数据资产 */}
      <div className="ov-section">
        <SectionHeading
          icon="stack"
          title={t("section.assetsTitle")}
          description={t("section.assetsSub")}
          action={
            <Button variant="secondary" size="sm" className="ov-view-more" onClick={() => router.push("/catalog")}>
              {t("viewDetails")}
            </Button>
          }
        />
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
        <div className="con-card no-pad">
          <div className="con-card-hd pad">
            <div>
              <div className="con-card-heading">{t("topTitle")}</div>
              <div className="con-card-sub">{t("topSub")}</div>
            </div>
          </div>
          <DataTable columns={columns} rows={data.topAssets} rowKey={(a) => a.id} onRowClick={(a) => router.push("/catalog/" + a.id)} />
        </div>
      </div>

      {/* 3. 数据服务 */}
      <div className="ov-section">
        <SectionHeading
          icon="broadcast"
          title={t("section.servicesTitle")}
          description={t("section.servicesSub", { running: data.servicesRunning, total: data.serviceCount })}
          action={
            <Button variant="secondary" size="sm" className="ov-view-more" onClick={() => router.push("/service")}>
              {t("viewDetails")}
            </Button>
          }
        />
        <div className="ov-link-grid">
          {data.servicesList.map((s) => (
            <button key={s.id} className="ov-link-card" onClick={() => router.push("/service")}>
              <span className="ov-link-card-ico">
                <PIcon name="broadcast" weight="fill" />
              </span>
              <span className="ov-link-card-body">
                <span className="ov-link-card-top">
                  <strong>{s.name}</strong>
                  <small>{s.status}</small>
                </span>
                <span>{s.method}</span>
                <small>{s.code}</small>
              </span>
            </button>
          ))}
          {!data.servicesList.length && <div className="dim">{t("noData")}</div>}
        </div>
      </div>

      {/* 4. 数据质量 */}
      <div className="ov-section">
        <SectionHeading
          icon="seal-check"
          title={t("qualityTitle")}
          description={t("qualitySub")}
          action={data.qualityScore > 0 ? <StatusBadge tone="success">{t("qualityRating")}</StatusBadge> : undefined}
        />
        <div className="con-card">
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

      {/* 5. 数据标准 */}
      <div className="ov-section">
        <SectionHeading
          icon="ruler"
          title={t("section.standardsTitle")}
          description={t("section.standardsSub", { published: data.standardsPublished, total: data.standardsTotal })}
          action={
            <Button variant="secondary" size="sm" className="ov-view-more" onClick={() => router.push("/standards")}>
              {t("viewDetails")}
            </Button>
          }
        />
        <div className="ov-link-grid">
          {data.standardsList.map((s) => (
            <button key={s.id} className="ov-link-card" onClick={() => router.push("/standards")}>
              <span className="ov-link-card-ico">
                <PIcon name="ruler" weight="fill" />
              </span>
              <span className="ov-link-card-body">
                <span className="ov-link-card-top">
                  <strong>{s.name}</strong>
                  <small>{s.status}</small>
                </span>
                <span>{s.type}</span>
                <small>{s.code}</small>
              </span>
            </button>
          ))}
          {!data.standardsList.length && <div className="dim">{t("noData")}</div>}
        </div>
      </div>

      {/* 6. 数据安全 */}
      <div className="ov-section">
        <SectionHeading
          icon="lock-key"
          title={t("section.securityTitle")}
          description={t("section.securitySub")}
          action={
            <Button variant="secondary" size="sm" className="ov-view-more" onClick={() => router.push("/security")}>
              {t("viewDetails")}
            </Button>
          }
        />
        <div className="stat-grid">
          <div className="stat-card stat-tone--blue">
            <PIcon className="stat-card-art" name="lock-key" weight="fill" aria-hidden />
            <div className="stat-card-top">
              <span className="stat-card-dot" aria-hidden />
              <span className="stat-card-label">{t("section.securityApiKeys")}</span>
            </div>
            <div className="stat-card-value-row">
              <span className="stat-card-value">{data.apiKeysActive.toLocaleString()}</span>
              <small className="stat-card-unit">{t("metrics.unitCount")}</small>
            </div>
          </div>
          <div className="stat-card stat-tone--blue">
            <PIcon className="stat-card-art" name="shield-check" weight="fill" aria-hidden />
            <div className="stat-card-top">
              <span className="stat-card-dot" aria-hidden />
              <span className="stat-card-label">{t("section.securityPolicies")}</span>
            </div>
            <div className="stat-card-value-row">
              <span className="stat-card-value">{data.policiesEnabled.toLocaleString()}</span>
              <small className="stat-card-unit">{t("metrics.unitCount")}</small>
            </div>
          </div>
        </div>
      </div>

      {/* 7. 数据汇集 */}
      <div className="ov-section">
        <SectionHeading icon="flow-arrow" title={t("section.aggTitle")} description={t("section.aggSub")} />

        <div className="con-card">
          <div className="con-card-hd">
            <div>
              <div className="con-card-heading">{t("section.aggBusiness")}</div>
              <div className="con-card-sub">{t("section.aggBusinessSub")}</div>
            </div>
            <PeriodSwitch paramKey="bizPeriod" value={periods.biz} scope="sub" rawParams={rawParams} />
          </div>
          {businessDonut.length ? <Donut data={businessDonut} caption={t("domainCaption")} /> : <div className="dim">{t("noData")}</div>}
        </div>

        <div className="con-card">
          <div className="con-card-hd">
            <div>
              <div className="con-card-heading">{t("section.aggTeam")}</div>
              <div className="con-card-sub">{t("section.aggTeamSub")}</div>
            </div>
            <PeriodSwitch paramKey="teamPeriod" value={periods.team} scope="sub" rawParams={rawParams} />
          </div>
          {teamBars.length ? <HBars data={teamBars} /> : <div className="dim">{t("noData")}</div>}
        </div>

        <div className="con-card">
          <div className="con-card-hd">
            <div>
              <div className="con-card-heading">{t("section.aggExternal")}</div>
              <div className="con-card-sub">{t("section.aggExternalSub", { connected: data.sourcesConnected, total: data.sourcesTotal })}</div>
            </div>
            <PeriodSwitch paramKey="extPeriod" value={periods.ext} scope="sub" rawParams={rawParams} />
          </div>
          <div className="ov-link-grid">
            {data.sourcesList.map((s) => (
              <button key={s.id} className="ov-link-card" onClick={() => router.push("/sources")}>
                <span className="ov-link-card-ico">
                  <PIcon name="database" weight="fill" />
                </span>
                <span className="ov-link-card-body">
                  <span className="ov-link-card-top">
                    <strong>{s.name}</strong>
                    <small>{s.status}</small>
                  </span>
                  <span>{s.type}</span>
                </span>
              </button>
            ))}
            {!data.sourcesList.length && <div className="dim">{t("noData")}</div>}
          </div>
        </div>
      </div>

      {/* 8. 风险告警 */}
      <div className="ov-section">
        <SectionHeading
          icon="warning"
          title={t("alertsTitle")}
          description={t("alertsSub", { count: ALERTS.length })}
          action={<StatusBadge tone="danger">{t("alertsCount")}</StatusBadge>}
        />
        <div className="con-card">
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
  );
}
