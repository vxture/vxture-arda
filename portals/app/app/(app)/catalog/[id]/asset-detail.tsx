"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Breadcrumb,
  NativeSelect,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  DataTable,
  EmptyState,
  Input,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  type DataTableColumn,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon, type PIconName } from "../../../ui/phosphor-icon";
import { Radar } from "../../../ui/charts";
import { QUALITY_DIMS } from "../../dashboard/seed";
import { DEPARTMENTS, DOMAINS, LEVEL_TONE, qualityTone, type AssetLevel } from "../seed";
import type { AssetProfile } from "../data";
import { attachStandard, attachTag, detachStandard, detachTag, setDatasetClassification, setGoldenRecord } from "../actions";

const ASSET_LEVELS: AssetLevel[] = ["public", "internal", "sensitive", "core"];

function domainIcon(domain: string | null): PIconName {
  return (domain && DOMAINS[domain]?.icon) || "stack";
}
function domainColor(domain: string | null): string {
  return (domain && DOMAINS[domain]?.color) || "var(--vx-color-text-muted)";
}

interface FieldRow {
  name: string;
  type: string;
  level: AssetLevel;
  std: string;
  pk?: boolean;
}

const DEMO_FIELDS: FieldRow[] = [
  { name: "id", type: "VARCHAR(36)", level: "core", std: "UUID v4", pk: true },
  { name: "workspace_id", type: "VARCHAR(36)", level: "internal", std: "Workspace key" },
  { name: "name", type: "VARCHAR(128)", level: "sensitive", std: "-" },
  { name: "status", type: "VARCHAR(24)", level: "internal", std: "Status code" },
  { name: "amount", type: "NUMERIC(18,2)", level: "sensitive", std: "ISO 4217" },
  { name: "region", type: "CHAR(2)", level: "public", std: "ISO 3166-1" },
  { name: "updated_at", type: "TIMESTAMP", level: "public", std: "-" },
];

const DEMO_SAMPLE = [
  ["8f3a***c21", "ws_01***", "Acme **", "active", "1,2**.00", "US"],
  ["2b9e***77a", "ws_04***", "Globex **", "active", "9**.50", "DE"],
  ["7c1d***0f5", "ws_02***", "Initech **", "trial", "0.00", "SG"],
];

export function AssetMissing() {
  const t = useTranslations("catalog");
  const router = useRouter();
  return (
    <div className="screen">
      <EmptyState
        title={
          <span className="app-empty-title">
            <PIcon name="stack" /> {t("notFoundTitle")}
          </span>
        }
        description={t("notFoundDesc")}
        action={<Button onClick={() => router.push("/catalog")}>{t("backToCatalog")}</Button>}
      />
    </div>
  );
}

export function AssetDetail({ asset, isAdmin = false }: { asset: AssetProfile; isAdmin?: boolean }) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const [tab, setTab] = useState("schema");
  const [newTag, setNewTag] = useState("");
  const [tagPending, startTagTransition] = useTransition();

  const addTag = () => {
    const name = newTag.trim();
    if (!name) return;
    startTagTransition(async () => {
      await attachTag(asset.id, name);
      setNewTag("");
    });
  };
  const removeTag = (tagId: string) => {
    startTagTransition(async () => {
      await detachTag(asset.id, tagId);
    });
  };
  const [stdSel, setStdSel] = useState("");
  const linkStd = () => {
    if (!stdSel) return;
    startTagTransition(async () => {
      await attachStandard(asset.id, stdSel);
      setStdSel("");
    });
  };
  const toggleGolden = () => {
    startTagTransition(async () => {
      await setGoldenRecord(asset.id, !asset.goldenRecord);
    });
  };
  const changeLevel = (level: string) => {
    startTagTransition(async () => {
      await setDatasetClassification(asset.id, level);
    });
  };

  const color = domainColor(asset.domain);
  const tint = `color-mix(in srgb, ${color} 14%, transparent)`;
  const dash = (v: string | number | null | undefined) => (v == null ? "-" : String(v));

  const stat = (label: string, value: string, icon: PIconName, accent?: boolean) => (
    <div className={"dstat" + (accent ? " accent" : "")}>
      <PIcon name={icon} />
      <div className="dstat-val">{value}</div>
      <div className="dstat-label">{label}</div>
    </div>
  );

  const fieldCols: DataTableColumn<FieldRow>[] = [
    {
      id: "name",
      header: t("field.name"),
      cell: (f) => (
        <span className="mono">
          {f.name}
          {f.pk && <span className="pk-tag">PK</span>}
        </span>
      ),
    },
    { id: "type", header: t("field.type"), cell: (f) => <span className="mono dim">{f.type}</span> },
    {
      id: "level",
      header: t("field.level"),
      cell: (f) => <StatusBadge tone={LEVEL_TONE[f.level]}>{t("level." + f.level)}</StatusBadge>,
    },
    { id: "std", header: t("field.std"), cell: (f) => <span className={f.std === "-" ? "dim" : "std-link"}>{f.std}</span> },
  ];

  return (
    <div className="screen">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => router.push("/catalog")} style={{ cursor: "pointer" }}>
              {t("title")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{asset.domain ? t("domain." + asset.domain) : asset.code}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{asset.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="con-card-hd">
        <div>
          <h1 className="detail-title">
            <span className="dt-ico" style={{ color, background: tint }}>
              <PIcon name={domainIcon(asset.domain)} />
            </span>
            {asset.name}
            <StatusBadge tone={LEVEL_TONE[asset.level]}>{t("level." + asset.level)}</StatusBadge>
            {asset.goldenRecord && (
              <StatusBadge tone="warning">
                <PIcon name="crown-simple" /> {t("golden")}
              </StatusBadge>
            )}
          </h1>
          {asset.description && <p className="con-card-sub">{asset.description}</p>}
          <div className="detail-codeline">
            <PIcon name="database" /> {asset.code} - {asset.id}
          </div>
        </div>
        <div className="ph-actions" style={{ display: "flex", gap: "var(--vx-space-xs)" }}>
          <Button variant="secondary" onClick={() => router.push(`/lineage?dataset=${asset.id}`)}>
            <PIcon name="tree-structure" /> {t("viewLineage")}
          </Button>
          {isAdmin && (
            <Button variant="secondary" disabled={tagPending} onClick={toggleGolden}>
              <PIcon name="crown-simple" /> {asset.goldenRecord ? t("goldenUnmark") : t("goldenMark")}
            </Button>
          )}
          <Button>
            <PIcon name="check" /> {t("requestAccess")}
          </Button>
        </div>
      </div>

      <div className="detail-stats">
        {stat(t("stat.rows"), asset.rows, "rows")}
        {stat(t("stat.fields"), dash(asset.fields), "columns")}
        {stat(t("stat.freq"), asset.refreshFreq ? t("freq." + asset.refreshFreq) : "-", "clock-clockwise")}
        {stat(t("stat.updated"), asset.updated, "arrows-clockwise")}
        {stat(t("stat.subs"), dash(asset.subs), "users-three")}
        {stat(t("stat.quality"), asset.quality == null ? "-" : asset.quality.toFixed(1), "seal-check", true)}
      </div>

      <div className="detail-cols">
        <div className="detail-main">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="schema">{t("tab.schema")}</TabsTrigger>
              <TabsTrigger value="sample">{t("tab.sample")}</TabsTrigger>
              <TabsTrigger value="quality">{t("tab.quality")}</TabsTrigger>
              <TabsTrigger value="lineage">{t("tab.lineage")}</TabsTrigger>
              <TabsTrigger value="access">{t("tab.access")}</TabsTrigger>
            </TabsList>

            <TabsContent value="schema">
              <div className="con-card no-pad">
                <DataTable columns={fieldCols} rows={DEMO_FIELDS} rowKey={(f) => f.name} />
              </div>
            </TabsContent>

            <TabsContent value="sample">
              <div className="con-card no-pad">
                <div className="con-card-hd pad">
                  <div className="con-card-heading">{t("samplePreview")}</div>
                  <StatusBadge tone="warning">
                    <PIcon name="lock-key" /> {t("masked")}
                  </StatusBadge>
                </div>
                <DataTable
                  columns={["id", "workspace_id", "name", "status", "amount", "region"].map((h, i) => ({
                    id: h,
                    header: h,
                    cell: (r: string[]) => <span className="mono">{r[i]}</span>,
                  }))}
                  rows={DEMO_SAMPLE}
                  rowKey={(_r, i) => i}
                />
              </div>
            </TabsContent>

            <TabsContent value="quality">
              <div className="con-card">
                <div className="con-card-hd">
                  <div className="con-card-heading">{t("qualityDims")}</div>
                  {asset.quality != null && (
                    <StatusBadge tone={qualityTone(asset.quality)}>{asset.quality.toFixed(1)}</StatusBadge>
                  )}
                </div>
                {asset.qualityDetail.total > 0 ? (
                  <p className="form-hint">
                    {t("qualitySummary", {
                      total: String(asset.qualityDetail.total),
                      pass: String(asset.qualityDetail.pass),
                      warn: String(asset.qualityDetail.warn),
                      fail: String(asset.qualityDetail.fail),
                      last: asset.qualityDetail.lastRunAt
                        ? new Date(asset.qualityDetail.lastRunAt).toLocaleString()
                        : "-",
                    })}
                  </p>
                ) : (
                  <p className="form-hint">{t("qualityNever")}</p>
                )}
                <div className="dq-body">
                  <Radar data={QUALITY_DIMS.map((d) => ({ name: t("dim." + d.key), score: d.score }))} size={220} />
                  <div className="dq-list">
                    {QUALITY_DIMS.map((d) => (
                      <div className="qm-dim" key={d.key}>
                        <span className="qm-dim-label">{t("dim." + d.key)}</span>
                        <span className="qm-dim-track">
                          <span style={{ width: d.score + "%" }} />
                        </span>
                        <span className="qm-dim-val">{d.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="lineage">
              <div className="con-card">
                <div className="empty-inline">
                  <PIcon name="tree-structure" />
                  <p>
                    {t("lineageCounts", {
                      up: String(asset.lineage.upstream),
                      down: String(asset.lineage.downstream),
                      services: String(asset.lineage.services.length),
                    })}
                    {asset.lineage.services.length > 0 && " " + asset.lineage.services.join(", ")}
                  </p>
                  <Button onClick={() => router.push(`/lineage?dataset=${asset.id}`)}>{t("openLineage")}</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="access">
              <div className="con-card">
                <div className="con-card-heading">{t("accessTitle", { name: asset.name })}</div>
                <p className="form-hint">
                  {t("accessHint", { level: t("level." + asset.level), owner: asset.owner ?? "-" })}
                </p>
                <div className="form-grid">
                  <label className="field">
                    <span>
                      {t("access.useCase")}
                      <i className="req">*</i>
                    </span>
                    <Input placeholder={t("access.useCasePh")} />
                  </label>
                  <label className="field">
                    <span>{t("access.scope")}</span>
                    <Input defaultValue={t("access.scopeDefault")} />
                  </label>
                  <label className="field span2">
                    <span>
                      {t("access.justification")}
                      <i className="req">*</i>
                    </span>
                    <Textarea rows={3} placeholder={t("access.justificationPh")} />
                  </label>
                  <label className="field">
                    <span>{t("access.duration")}</span>
                    <Input defaultValue={t("access.durationDefault")} />
                  </label>
                  <label className="field">
                    <span>{t("access.method")}</span>
                    <Input defaultValue="API" />
                  </label>
                </div>
                <div className="form-foot">
                  <Button variant="secondary">{t("access.draft")}</Button>
                  <Button>
                    <PIcon name="check" /> {t("access.submit")}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="detail-side">
          <div className="con-card">
            <div className="con-card-heading">{t("assetInfo")}</div>
            <dl className="kv">
              <div>
                <dt>{t("info.dept")}</dt>
                <dd>
                  {asset.team ? (
                    <span className="dept-tag">
                      <span className="dept-dot" style={{ background: DEPARTMENTS[asset.team]?.color }} />
                      {t("dept." + asset.team)}
                    </span>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
              <div>
                <dt>{t("info.owner")}</dt>
                <dd>{asset.owner ?? "-"}</dd>
              </div>
              <div>
                <dt>{t("info.domain")}</dt>
                <dd>{asset.domain ? t("domain." + asset.domain) : "-"}</dd>
              </div>
              <div>
                <dt>{t("info.freq")}</dt>
                <dd>{asset.refreshFreq ? t("freq." + asset.refreshFreq) : "-"}</dd>
              </div>
              <div>
                <dt>{t("info.storage")}</dt>
                <dd className="mono dim">
                  {asset.storage.bytes}
                  {asset.storage.sharePct != null && ` (${asset.storage.sharePct}%)`}
                </dd>
              </div>
              <div>
                <dt>{t("info.source")}</dt>
                <dd>
                  {asset.source
                    ? `${asset.source.name}${asset.source.lastSyncedAt ? " · " + new Date(asset.source.lastSyncedAt).toLocaleDateString() : ""}`
                    : "-"}
                </dd>
              </div>
              <div>
                <dt>{t("info.level")}</dt>
                <dd style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StatusBadge tone={LEVEL_TONE[asset.level]}>{t("level." + asset.level)}</StatusBadge>
                  {isAdmin && (
                    <NativeSelect
                      aria-label={t("info.level")}
                      value={asset.level}
                      disabled={tagPending}
                      onChange={(e) => changeLevel(e.target.value)}
                      style={{ maxWidth: 130 }}
                    >
                      {ASSET_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {t("level." + lvl)}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <div className="con-card">
            <div className="con-card-heading">{t("tags")}</div>
            <div className="tag-list">
              {asset.tags.map((tg) => (
                <span className="tag" key={tg.id}>
                  {tg.name}
                  {isAdmin && (
                    <button
                      aria-label={t("removeTag", { name: tg.name })}
                      disabled={tagPending}
                      onClick={() => removeTag(tg.id)}
                      style={{ border: 0, background: "none", cursor: "pointer", padding: 0, marginLeft: 4, color: "inherit" }}
                    >
                      <PIcon name="x" />
                    </button>
                  )}
                </span>
              ))}
              {asset.tags.length === 0 && !isAdmin && <span className="dim">-</span>}
            </div>
            {isAdmin && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <Input
                  value={newTag}
                  maxLength={60}
                  placeholder={t("addTagPh")}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTag()}
                />
                <Button size="sm" disabled={tagPending || !newTag.trim()} onClick={addTag}>
                  <PIcon name="plus" />
                </Button>
              </div>
            )}
          </div>
          <div className="con-card">
            <div className="con-card-heading">{t("standardsCard")}</div>
            <div className="tag-list">
              {asset.standards.map((st) => (
                <span className="tag" key={st.id}>
                  {st.name}
                  {isAdmin && (
                    <button
                      aria-label={t("removeStandard", { name: st.name })}
                      disabled={tagPending}
                      onClick={() =>
                        startTagTransition(async () => {
                          await detachStandard(asset.id, st.id);
                        })
                      }
                      style={{ border: 0, background: "none", cursor: "pointer", padding: 0, marginLeft: 4, color: "inherit" }}
                    >
                      <PIcon name="x" />
                    </button>
                  )}
                </span>
              ))}
              {asset.standards.length === 0 && <span className="dim">-</span>}
            </div>
            {isAdmin && asset.linkableStandards.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <NativeSelect value={stdSel} onChange={(e) => setStdSel(e.target.value)} aria-label={t("standardsCard")}>
                  <option value="">-</option>
                  {asset.linkableStandards
                    .filter((o) => !asset.standards.some((st) => st.id === o.id))
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                </NativeSelect>
                <Button size="sm" disabled={tagPending || !stdSel} onClick={linkStd}>
                  <PIcon name="plus" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
