"use client";

import { useState, useTransition } from "react";
import {
  Button,
  DataTable,
  Input,
  MetricGrid,
  NativeSelect,
  StatusBadge,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { SectionHeading } from "../../ui/section-heading";
import { Donut } from "../../ui/charts";
import { LEVEL_TONE, REQUEST_TONE, REQUESTS, type ShareRequest } from "./seed";
import type { AssetLevel } from "../dashboard/seed";
import type { DatasetOption, MaskingRuleView, PolicyData, SecurityData } from "./data";
import { createMaskingRule, deleteMaskingRule, setMaxExternalLevel } from "./actions";

const ASSET_LEVELS: AssetLevel[] = ["public", "internal", "sensitive", "core"];
const STRATEGIES = ["redact", "hash", "partial"];

export function SecurityList({
  data,
  policies,
  datasets,
  isAdmin = false,
}: {
  data: SecurityData;
  policies: PolicyData;
  datasets: DatasetOption[];
  isAdmin?: boolean;
}) {
  const t = useTranslations("security");
  const [pending, startTransition] = useTransition();
  const [ruleDataset, setRuleDataset] = useState("");
  const [ruleFields, setRuleFields] = useState("");
  const [ruleStrategy, setRuleStrategy] = useState("redact");

  const metrics: MetricGridItem[] = [
    { id: "coverage", label: t("metrics.coverage"), value: data.total ? data.coverage.toFixed(1) + "%" : "-", tone: "positive" },
    { id: "masking", label: t("metrics.masking"), value: policies.maskingRules.length.toLocaleString() },
    { id: "core", label: t("metrics.core"), value: data.coreCount.toLocaleString(), tone: "danger" },
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

  const maskCols: DataTableColumn<MaskingRuleView>[] = [
    { id: "dataset", header: t("maskCol.dataset"), cell: (r) => r.datasetName ?? t("maskAllDatasets") },
    { id: "fields", header: t("maskCol.fields"), cell: (r) => <span className="mono">{r.fields.join(", ")}</span> },
    { id: "strategy", header: t("maskCol.strategy"), cell: (r) => t("strategy." + r.strategy) },
    ...(isAdmin
      ? [
          {
            id: "actions",
            header: "",
            cell: (r: MaskingRuleView) => (
              <button
                aria-label={t("maskRemove")}
                disabled={pending}
                onClick={() => startTransition(async () => { await deleteMaskingRule(r.id); })}
                style={{ border: 0, background: "none", cursor: "pointer", padding: 0, color: "inherit" }}
              >
                <PIcon name="x" />
              </button>
            ),
          } as DataTableColumn<MaskingRuleView>,
        ]
      : []),
  ];

  const addRule = () => {
    const fields = ruleFields.split(",").map((f) => f.trim()).filter(Boolean);
    if (fields.length === 0) return;
    startTransition(async () => {
      await createMaskingRule({ datasetId: ruleDataset || null, fields, strategy: ruleStrategy });
      setRuleFields("");
      setRuleDataset("");
    });
  };

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

      <div className="dash-cols">
        <div className="con-card">
          <div className="con-card-hd">
            <div className="con-card-heading">{t("accessTitle")}</div>
          </div>
          <p className="form-hint">{t("accessHint")}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StatusBadge tone={LEVEL_TONE[policies.maxExternalLevel]}>{t("level." + policies.maxExternalLevel)}</StatusBadge>
            {isAdmin && (
              <NativeSelect
                aria-label={t("accessTitle")}
                value={policies.maxExternalLevel}
                disabled={pending}
                onChange={(e) => startTransition(async () => { await setMaxExternalLevel(e.target.value); })}
                style={{ maxWidth: 140 }}
              >
                {ASSET_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {t("level." + lvl)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </div>
        </div>
        <div className="con-card no-pad">
          <div className="con-card-hd pad">
            <div className="con-card-heading">{t("maskingTitle")}</div>
          </div>
          {policies.maskingRules.length > 0 ? (
            <DataTable columns={maskCols} rows={policies.maskingRules} rowKey={(r) => r.id} />
          ) : (
            <div className="empty-inline">
              <PIcon name="lock-key" />
              <p>{t("maskingEmpty")}</p>
            </div>
          )}
          {isAdmin && (
            <div style={{ display: "flex", gap: 6, padding: "0 var(--vx-space-md) var(--vx-space-md)" }}>
              <NativeSelect aria-label={t("maskCol.dataset")} value={ruleDataset} onChange={(e) => setRuleDataset(e.target.value)}>
                <option value="">{t("maskAllDatasets")}</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
              <Input
                value={ruleFields}
                placeholder={t("maskFieldsPh")}
                onChange={(e) => setRuleFields(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRule()}
              />
              <NativeSelect aria-label={t("maskCol.strategy")} value={ruleStrategy} onChange={(e) => setRuleStrategy(e.target.value)}>
                {STRATEGIES.map((s) => (
                  <option key={s} value={s}>
                    {t("strategy." + s)}
                  </option>
                ))}
              </NativeSelect>
              <Button size="sm" disabled={pending || !ruleFields.trim()} onClick={addRule}>
                <PIcon name="plus" />
              </Button>
            </div>
          )}
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
