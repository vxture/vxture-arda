"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  DataTable,
  PageHeader,
  StatusBadge,
  ViewModeSwitch,
  type DataTableColumn,
  type ViewModeSwitchValue,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { ASSETS, DEPARTMENTS, DOMAINS, LEVEL_TONE, qualityTone, type CatalogAsset } from "./seed";

const DOMAIN_KEYS = Object.keys(DOMAINS);

export default function CatalogPage() {
  const t = useTranslations("catalog");
  const router = useRouter();
  const [domain, setDomain] = useState<string>("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<ViewModeSwitchValue>("cards");

  const open = (id: string) => router.push(`/catalog/${id}`);

  const list = useMemo(() => {
    let rows = ASSETS;
    if (domain !== "all") rows = rows.filter((a) => a.domain === domain);
    const term = q.trim().toLowerCase();
    if (term) rows = rows.filter((a) => (a.name + a.code).toLowerCase().includes(term));
    return rows;
  }, [domain, q]);

  const deptTag = (dept: string) => (
    <span className="dept-tag">
      <span className="dept-dot" style={{ background: DEPARTMENTS[dept]?.color }} />
      {t("dept." + dept)}
    </span>
  );

  const columns: DataTableColumn<CatalogAsset>[] = [
    {
      id: "asset",
      header: t("col.asset"),
      cell: (a) => (
        <div className="cell-asset">
          <span className="cell-asset-ico" style={{ color: DOMAINS[a.domain].color }}>
            <PIcon name={DOMAINS[a.domain].icon} />
          </span>
          <div>
            <div className="cell-asset-name">{a.name}</div>
            <div className="cell-asset-code">{a.code}</div>
          </div>
        </div>
      ),
    },
    { id: "domain", header: t("col.domain"), cell: (a) => t("domain." + a.domain) },
    { id: "dept", header: t("col.dept"), cell: (a) => deptTag(a.dept) },
    {
      id: "level",
      header: t("col.level"),
      cell: (a) => <StatusBadge tone={LEVEL_TONE[a.level]}>{t("level." + a.level)}</StatusBadge>,
    },
    { id: "rows", header: t("col.rows"), align: "right", cell: (a) => <span className="mono">{a.rows}</span> },
    { id: "freq", header: t("col.freq"), cell: (a) => t("freq." + a.freq) },
    {
      id: "quality",
      header: t("col.quality"),
      cell: (a) => <StatusBadge tone={qualityTone(a.quality)}>{a.quality.toFixed(1)}</StatusBadge>,
    },
    { id: "subs", header: t("col.subs"), align: "right", cell: (a) => a.subs },
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

      <div className="domain-strip">
        <button className={"domain-chip" + (domain === "all" ? " active" : "")} onClick={() => setDomain("all")}>
          <PIcon name="stack" /> {t("all")}
          <span className="dc-count">{ASSETS.length}</span>
        </button>
        {DOMAIN_KEYS.map((d) => (
          <button key={d} className={"domain-chip" + (domain === d ? " active" : "")} onClick={() => setDomain(d)}>
            <PIcon name={DOMAINS[d].icon} /> {t("domain." + d)}
            <span className="dc-count">{ASSETS.filter((a) => a.domain === d).length}</span>
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
                    color: DOMAINS[a.domain].color,
                    background: `color-mix(in srgb, ${DOMAINS[a.domain].color} 14%, transparent)`,
                  }}
                >
                  <PIcon name={DOMAINS[a.domain].icon} />
                </span>
                <StatusBadge tone={LEVEL_TONE[a.level]}>{t("level." + a.level)}</StatusBadge>
              </div>
              <div className="ac-name">{a.name}</div>
              <div className="ac-code">{a.code}</div>
              <div className="ac-desc">{a.desc}</div>
              <div className="ac-meta">{deptTag(a.dept)}</div>
              <div className="ac-foot">
                <span className="ac-stat">
                  <PIcon name="rows" /> {a.rows}
                </span>
                <span className="ac-stat">
                  <PIcon name="columns" /> {a.fields}
                </span>
                <span className="ac-stat">
                  <PIcon name="users" /> {a.subs}
                </span>
                <span className="ac-q">
                  <StatusBadge tone={qualityTone(a.quality)}>{a.quality.toFixed(1)}</StatusBadge>
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="con-card no-pad">
          <DataTable columns={columns} rows={list} rowKey={(a) => a.id} onRowClick={(a) => open(a.id)} />
        </div>
      )}
    </div>
  );
}
