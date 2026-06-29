"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  StatusBadge,
  ViewModeSwitch,
  type DataTableColumn,
  type ViewModeSwitchValue,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon, type PIconName } from "../../ui/phosphor-icon";
import { DEPARTMENTS, DOMAINS, LEVEL_TONE, qualityTone } from "./seed";
import type { CatalogAssetView } from "./data";

const ALL_DOMAINS = Object.keys(DOMAINS);

function domainIcon(domain: string | null): PIconName {
  return (domain && DOMAINS[domain]?.icon) || "stack";
}
function domainColor(domain: string | null): string {
  return (domain && DOMAINS[domain]?.color) || "var(--vx-color-text-muted)";
}

export function CatalogList({ assets }: { assets: CatalogAssetView[] }) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const [domain, setDomain] = useState<string>("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewModeSwitchValue>("cards");

  const open = (id: string) => router.push(`/catalog/${id}`);

  // Only show domain chips for domains actually present.
  const presentDomains = ALL_DOMAINS.filter((d) => assets.some((a) => a.domain === d));

  const list = useMemo(() => {
    let rows = assets;
    if (domain !== "all") rows = rows.filter((a) => a.domain === domain);
    const term = q.trim().toLowerCase();
    if (term) rows = rows.filter((a) => (a.name + a.code).toLowerCase().includes(term));
    return rows;
  }, [assets, domain, q]);

  const deptTag = (team: string | null) =>
    team ? (
      <span className="dept-tag">
        <span className="dept-dot" style={{ background: DEPARTMENTS[team]?.color }} />
        {t("dept." + team)}
      </span>
    ) : (
      <span className="dim">-</span>
    );

  const qualityCell = (q: number | null) =>
    q == null ? <span className="dim">-</span> : <StatusBadge tone={qualityTone(q)}>{q.toFixed(1)}</StatusBadge>;

  const columns: DataTableColumn<CatalogAssetView>[] = [
    {
      id: "asset",
      header: t("col.asset"),
      cell: (a) => (
        <div className="cell-asset">
          <span className="cell-asset-ico" style={{ color: domainColor(a.domain) }}>
            <PIcon name={domainIcon(a.domain)} />
          </span>
          <div>
            <div className="cell-asset-name">{a.name}</div>
            <div className="cell-asset-code">{a.code}</div>
          </div>
        </div>
      ),
    },
    { id: "domain", header: t("col.domain"), cell: (a) => (a.domain ? t("domain." + a.domain) : "-") },
    { id: "dept", header: t("col.dept"), cell: (a) => deptTag(a.team) },
    {
      id: "level",
      header: t("col.level"),
      cell: (a) => <StatusBadge tone={LEVEL_TONE[a.level]}>{t("level." + a.level)}</StatusBadge>,
    },
    { id: "rows", header: t("col.rows"), align: "right", cell: (a) => <span className="mono">{a.rows}</span> },
    { id: "freq", header: t("col.freq"), cell: (a) => (a.refreshFreq ? t("freq." + a.refreshFreq) : "-") },
    { id: "quality", header: t("col.quality"), cell: (a) => qualityCell(a.quality) },
    { id: "subs", header: t("col.subs"), align: "right", cell: (a) => a.subs ?? "-" },
    { id: "go", header: "", align: "right", cell: () => <PIcon className="cell-caret" name="caret-right" /> },
  ];

  return (
    <div className="screen">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            <Button variant="secondary">
              <PIcon name="database" /> {t("register")}
            </Button>
            <Button>
              <PIcon name="plus" /> {t("newDataset")}
            </Button>
          </>
        }
      />

      {assets.length === 0 ? (
        <EmptyState
          title={
            <span className="app-empty-title">
              <PIcon name="stack" /> {t("emptyTitle")}
            </span>
          }
          description={t("emptyDesc")}
        />
      ) : (
        <>
          <div className="domain-strip">
            <button className={"domain-chip" + (domain === "all" ? " active" : "")} onClick={() => setDomain("all")}>
              <PIcon name="stack" /> {t("all")}
              <span className="dc-count">{assets.length}</span>
            </button>
            {presentDomains.map((d) => (
              <button key={d} className={"domain-chip" + (domain === d ? " active" : "")} onClick={() => setDomain(d)}>
                <PIcon name={DOMAINS[d].icon} /> {t("domain." + d)}
                <span className="dc-count">{assets.filter((a) => a.domain === d).length}</span>
              </button>
            ))}
          </div>

          <div className="filterbar">
            <label className="fb-search">
              <PIcon name="magnifying-glass" />
              <input
                placeholder={t("searchPlaceholder", { count: list.length })}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <span className="fb-count">{t("count", { count: list.length })}</span>
            <ViewModeSwitch
              value={view}
              onChange={setView}
              ariaLabel={t("view")}
              listLabel={t("viewTable")}
              cardsLabel={t("viewCards")}
            />
          </div>

          {view === "cards" ? (
            <div className="asset-grid">
              {list.map((a) => (
                <button key={a.id} className="asset-card" onClick={() => open(a.id)}>
                  <div className="ac-top">
                    <span
                      className="ac-ico"
                      style={{
                        color: domainColor(a.domain),
                        background: `color-mix(in srgb, ${domainColor(a.domain)} 14%, transparent)`,
                      }}
                    >
                      <PIcon name={domainIcon(a.domain)} />
                    </span>
                    <StatusBadge tone={LEVEL_TONE[a.level]}>{t("level." + a.level)}</StatusBadge>
                  </div>
                  <div className="ac-name">{a.name}</div>
                  <div className="ac-code">{a.code}</div>
                  {a.description && <div className="ac-desc">{a.description}</div>}
                  <div className="ac-meta">{deptTag(a.team)}</div>
                  <div className="ac-foot">
                    <span className="ac-stat">
                      <PIcon name="rows" /> {a.rows}
                    </span>
                    <span className="ac-q">{qualityCell(a.quality)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="con-card no-pad">
              <DataTable columns={columns} rows={list} rowKey={(a) => a.id} onRowClick={(a) => open(a.id)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
