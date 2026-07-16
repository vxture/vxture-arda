"use client";

import { useState, useTransition } from "react";
import {
  DataTable,
  Input,
  MetricGrid,
  NativeSelect,
  StatusBadge,
  Button,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon, type PIconName } from "../../ui/phosphor-icon";
import { SectionHeading } from "../../ui/section-heading";
import { AreaChart, Radar } from "../../ui/charts";
import { LEVEL_TONE, passColor, QUALITY_DIMS, SCORE_TREND } from "./seed";
import { createQualityRule, deleteQualityRule, runWorkspaceChecks, setQualityRuleEnabled, type RunChecksResult } from "./actions";
import type { DatasetOption, QualityMetrics, QualityRuleView, Trend } from "./data";

const DIMENSIONS = ["completeness", "accuracy", "consistency", "timeliness", "uniqueness", "validity"];
const RULE_TYPES = ["not_null", "unique", "range", "freshness", "row_count"];
const SEVERITIES = ["warning", "critical"];

const TREND_META: Record<Trend, { icon: PIconName; color: string }> = {
  up: { icon: "trend-up", color: "var(--vx-color-success-600)" },
  down: { icon: "trend-down", color: "var(--vx-color-danger-600)" },
  flat: { icon: "minus", color: "var(--vx-color-text-muted)" },
};

function compact(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function QualityList({
  rules,
  metrics,
  datasets,
  isAdmin = false,
}: {
  rules: QualityRuleView[];
  metrics: QualityMetrics;
  datasets: DatasetOption[];
  isAdmin?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [runMsg, setRunMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const t = useTranslations("quality");

  const [ruleDataset, setRuleDataset] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [ruleDim, setRuleDim] = useState(DIMENSIONS[0]);
  const [ruleType, setRuleType] = useState(RULE_TYPES[0]);
  const [ruleSeverity, setRuleSeverity] = useState(SEVERITIES[0]);

  const addRule = () => {
    const name = ruleName.trim();
    if (!ruleDataset || !name) return;
    startTransition(async () => {
      const res = await createQualityRule({ datasetId: ruleDataset, name, dimension: ruleDim, type: ruleType, severity: ruleSeverity });
      if (res.ok) setRuleName("");
    });
  };

  const runChecks = () => {
    setRunMsg(null);
    startTransition(async () => {
      const res: RunChecksResult = await runWorkspaceChecks();
      if (res.ok) {
        setRunMsg({
          tone: res.failed > 0 ? "err" : "ok",
          text: t("run.done", {
            ran: String(res.ran),
            passed: String(res.passed),
            warned: String(res.warned),
            failed: String(res.failed),
          }) + (res.skipped > 0 ? " " + t("run.skipped", { n: String(res.skipped) }) : ""),
        });
      } else {
        setRunMsg({ tone: "err", text: t("run.error." + res.error) });
      }
    });
  };

  const metricItems: MetricGridItem[] = [
    { id: "score", label: t("metrics.score"), value: metrics.score ? metrics.score.toFixed(1) : "-", tone: "positive" },
    { id: "rules", label: t("metrics.rules"), value: metrics.rules.toLocaleString() },
    { id: "issues", label: t("metrics.issues"), value: compact(metrics.issues), tone: "warning" },
    { id: "pending", label: t("metrics.pending"), value: metrics.pending.toLocaleString(), tone: metrics.pending ? "warning" : "default" },
  ];

  const columns: DataTableColumn<QualityRuleView>[] = [
    {
      id: "rule",
      header: t("col.rule"),
      cell: (r) => (
        <div>
          <div className="cell-asset-name">{r.name}</div>
          <div className="cell-asset-code">{r.code}</div>
        </div>
      ),
    },
    { id: "target", header: t("col.target"), cell: (r) => r.target },
    { id: "dim", header: t("col.dim"), cell: (r) => <span className="dim-tag">{t("dim." + r.dim)}</span> },
    {
      id: "level",
      header: t("col.level"),
      cell: (r) => <StatusBadge tone={LEVEL_TONE[r.level]}>{t("level." + r.level)}</StatusBadge>,
    },
    {
      id: "pass",
      header: t("col.pass"),
      cell: (r) =>
        r.pass == null ? (
          <span className="dim">-</span>
        ) : (
          <div className="pass-cell">
            <span className="pass-track">
              <span style={{ width: r.pass + "%", background: passColor(r.pass) }} />
            </span>
            <span className="pass-val">{r.pass}%</span>
          </div>
        ),
    },
    { id: "issues", header: t("col.issues"), align: "right", cell: (r) => (r.issues == null ? "-" : r.issues.toLocaleString()) },
    {
      id: "trend",
      header: t("col.trend"),
      cell: (r) => <PIcon name={TREND_META[r.trend].icon} color={TREND_META[r.trend].color} />,
    },
    {
      id: "enabled",
      header: t("col.enabled"),
      cell: (r) =>
        isAdmin ? (
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await setQualityRuleEnabled(r.id, !r.enabled); })}
            style={{ border: 0, background: "none", cursor: "pointer", padding: 0 }}
          >
            <StatusBadge tone={r.enabled ? "success" : "warning"}>{r.enabled ? t("enabled.on") : t("enabled.off")}</StatusBadge>
          </button>
        ) : (
          <StatusBadge tone={r.enabled ? "success" : "warning"}>{r.enabled ? t("enabled.on") : t("enabled.off")}</StatusBadge>
        ),
    },
    ...(isAdmin
      ? [
          {
            id: "remove",
            header: "",
            cell: (r: QualityRuleView) => (
              <button
                aria-label={t("removeRule")}
                disabled={pending}
                onClick={() => startTransition(async () => { await deleteQualityRule(r.id); })}
                style={{ border: 0, background: "none", cursor: "pointer", padding: 0, color: "inherit" }}
              >
                <PIcon name="x" />
              </button>
            ),
          } as DataTableColumn<QualityRuleView>,
        ]
      : []),
  ];

  return (
    <div className="screen">
      <SectionHeading
        level="page"
        icon="seal-check"
        title={t("title")}
        description={t("description")}
        action={
          isAdmin && (
            <Button disabled={pending} onClick={runChecks}>
              <PIcon name="play" /> {pending ? t("run.running") : t("runAudit")}
            </Button>
          )
        }
      />

      <MetricGrid items={metricItems} />

      {runMsg && (
        <p
          role="status"
          style={{
            fontSize: 13,
            color: runMsg.tone === "ok" ? "var(--vx-color-success-600)" : "var(--vx-color-danger-600)",
          }}
        >
          {runMsg.text}
        </p>
      )}

      <div className="dash-cols">
        <div className="con-card">
          <div className="con-card-hd">
            <div>
              <div className="con-card-heading">{t("trendTitle")}</div>
              <div className="con-card-sub">{t("trendSub")}</div>
            </div>
            <StatusBadge tone="success">{t("ratingGood")}</StatusBadge>
          </div>
          <AreaChart data={SCORE_TREND} id="qTrend" color="var(--vx-color-success-600)" height={150} />
        </div>
        <div className="con-card">
          <div className="con-card-hd">
            <div className="con-card-heading">{t("sixDim")}</div>
          </div>
          <div className="q-radar-center">
            <Radar data={QUALITY_DIMS.map((d) => ({ name: t("dim." + d.key), score: d.score }))} size={230} />
          </div>
        </div>
      </div>

      <div className="con-card no-pad">
        <div className="con-card-hd pad">
          <div>
            <div className="con-card-heading">{t("execTitle")}</div>
            <div className="con-card-sub">{t("execSub")}</div>
          </div>
        </div>
        <DataTable columns={columns} rows={rules} rowKey={(r) => r.id} />
        {isAdmin && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 var(--vx-space-md) var(--vx-space-md)" }}>
            <NativeSelect aria-label={t("col.target")} value={ruleDataset} onChange={(e) => setRuleDataset(e.target.value)}>
              <option value="">-</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
            <Input
              value={ruleName}
              maxLength={120}
              placeholder={t("ruleNamePh")}
              onChange={(e) => setRuleName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRule()}
            />
            <NativeSelect aria-label={t("col.dim")} value={ruleDim} onChange={(e) => setRuleDim(e.target.value)}>
              {DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {t("dim." + d)}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect aria-label={t("ruleTypeLabel")} value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
              {RULE_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t("ruleType." + ty)}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect aria-label={t("severityLabel")} value={ruleSeverity} onChange={(e) => setRuleSeverity(e.target.value)}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {t("severity." + s)}
                </option>
              ))}
            </NativeSelect>
            <Button size="sm" disabled={pending || !ruleDataset || !ruleName.trim()} onClick={addRule}>
              <PIcon name="plus" /> {t("addRule")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
