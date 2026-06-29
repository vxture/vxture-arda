"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Breadcrumb,
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
import {
  DEPARTMENTS,
  DOMAINS,
  getAsset,
  LEVEL_TONE,
  qualityTone,
  type AssetLevel,
} from "../seed";

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

export default function AssetDetailPage() {
  const t = useTranslations("catalog");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const asset = getAsset(params.id);
  const [tab, setTab] = useState("schema");

  if (!asset) {
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

  const dom = DOMAINS[asset.domain];
  const tint = `color-mix(in srgb, ${dom.color} 14%, transparent)`;

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
            <BreadcrumbPage>{t("domain." + asset.domain)}</BreadcrumbPage>
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
            <span className="dt-ico" style={{ color: dom.color, background: tint }}>
              <PIcon name={dom.icon} />
            </span>
            {asset.name}
            <StatusBadge tone={LEVEL_TONE[asset.level]}>{t("level." + asset.level)}</StatusBadge>
          </h1>
          <p className="con-card-sub">{asset.desc}</p>
          <div className="detail-codeline">
            <PIcon name="database" /> {asset.code} - {asset.id}
          </div>
        </div>
        <div className="ph-actions" style={{ display: "flex", gap: "var(--vx-space-xs)" }}>
          <Button variant="secondary" onClick={() => router.push("/lineage")}>
            <PIcon name="tree-structure" /> {t("viewLineage")}
          </Button>
          <Button>
            <PIcon name="check" /> {t("requestAccess")}
          </Button>
        </div>
      </div>

      <div className="detail-stats">
        {stat(t("stat.rows"), asset.rows, "rows")}
        {stat(t("stat.fields"), String(asset.fields), "columns")}
        {stat(t("stat.freq"), t("freq." + asset.freq), "clock-clockwise")}
        {stat(t("stat.updated"), asset.updated, "arrows-clockwise")}
        {stat(t("stat.subs"), String(asset.subs), "users-three")}
        {stat(t("stat.quality"), asset.quality.toFixed(1), "seal-check", true)}
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
                  <StatusBadge tone={qualityTone(asset.quality)}>{asset.quality.toFixed(1)}</StatusBadge>
                </div>
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
                  <p>{t("lineageHint")}</p>
                  <Button onClick={() => router.push("/lineage")}>{t("openLineage")}</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="access">
              <div className="con-card">
                <div className="con-card-heading">{t("accessTitle", { name: asset.name })}</div>
                <p className="form-hint">{t("accessHint", { level: t("level." + asset.level), owner: asset.owner })}</p>
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
                  <span className="dept-tag">
                    <span className="dept-dot" style={{ background: DEPARTMENTS[asset.dept]?.color }} />
                    {t("dept." + asset.dept)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{t("info.owner")}</dt>
                <dd>{asset.owner}</dd>
              </div>
              <div>
                <dt>{t("info.domain")}</dt>
                <dd>{t("domain." + asset.domain)}</dd>
              </div>
              <div>
                <dt>{t("info.freq")}</dt>
                <dd>{t("freq." + asset.freq)}</dd>
              </div>
              <div>
                <dt>{t("info.storage")}</dt>
                <dd className="mono dim">dw://{asset.code}</dd>
              </div>
              <div>
                <dt>{t("info.level")}</dt>
                <dd>
                  <StatusBadge tone={LEVEL_TONE[asset.level]}>{t("level." + asset.level)}</StatusBadge>
                </dd>
              </div>
            </dl>
          </div>
          <div className="con-card">
            <div className="con-card-heading">{t("tags")}</div>
            <div className="tag-list">
              {[t("domain." + asset.domain), t("freq." + asset.freq), t("tagGoverned"), t("tagHighUse")].map((tg) => (
                <span className="tag" key={tg}>
                  {tg}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
