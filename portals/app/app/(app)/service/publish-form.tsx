"use client";

import { useMemo, useState, useTransition } from "react";
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
import { LEVEL_TONE, METHOD_COLOR, STATUS_META } from "./seed";
import {
  createDataService,
  deleteDataService,
  publishDataService,
  unpublishDataService,
  updateDataService,
  type ServiceInput,
  type ServiceWriteResult,
} from "./actions";
import type { DatasetOption, ManagedService } from "./publish-data";

const METHODS = ["GET", "POST"];
const TYPES = ["rest_api", "query", "export", "share"];
const LEVELS = ["public", "internal", "sensitive", "core"];
const DOMAINS = ["customer", "product", "marketing", "finance", "operations", "web"];

const EMPTY: ServiceInput = { name: "", path: "", method: "GET", type: "rest_api", level: "internal", domain: null, description: null, datasetIds: [] };

/** Data service authoring (Svc-BL5): create/edit drafts, link datasets, then
 *  publish (quality-gated), unpublish or delete. */
export function PublishForm({ services, datasets, isAdmin = false }: { services: ManagedService[]; datasets: DatasetOption[]; isAdmin?: boolean }) {
  const t = useTranslations("service");
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceInput>(EMPTY);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const set = <K extends keyof ServiceInput>(k: K, v: ServiceInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const nameById = useMemo(() => new Map(datasets.map((d) => [d.id, d.name])), [datasets]);
  const available = datasets.filter((d) => !form.datasetIds.includes(d.id));

  const reset = () => {
    setEditingId(null);
    setForm(EMPTY);
  };

  const edit = (s: ManagedService) => {
    setMsg(null);
    setEditingId(s.id);
    setForm({ name: s.name, path: s.path, method: s.method, type: s.type, level: s.level, domain: s.domain, description: s.description, datasetIds: s.datasetIds });
  };

  const report = (res: ServiceWriteResult | { ok: true; warnings: unknown[] } | { ok: false; error: string }, okKey: string) => {
    if (res.ok) {
      setMsg({ tone: "ok", text: t(okKey) });
      return true;
    }
    setMsg({ tone: "err", text: t("pub.error." + res.error) });
    return false;
  };

  const submit = () => {
    if (!form.name.trim() || !form.path.trim()) return;
    setMsg(null);
    startTransition(async () => {
      const res = editingId ? await updateDataService(editingId, form) : await createDataService(form);
      if (report(res, editingId ? "pub.updated" : "pub.created")) reset();
    });
  };

  const act = (fn: () => Promise<ServiceWriteResult>, okKey: string) =>
    startTransition(async () => {
      report(await fn(), okKey);
    });

  const publish = (id: string) =>
    startTransition(async () => {
      const res = await publishDataService(id);
      if (res.ok) setMsg({ tone: "ok", text: t("publishDone") + (res.warnings.length ? " " + t("publishWarn", { n: String(res.warnings.length) }) : "") });
      else if (res.error === "quality") setMsg({ tone: "err", text: t("publishBlocked", { blockers: (res.blockers ?? []).map((b) => `${b.datasetName}: ${b.ruleName}`).join("; ") }) });
      else setMsg({ tone: "err", text: t("pub.error." + res.error) });
    });

  const metrics: MetricGridItem[] = [
    { id: "total", label: t("pub.mTotal"), value: services.length.toLocaleString() },
    { id: "running", label: t("pub.mRunning"), value: services.filter((s) => s.status === "running").length.toLocaleString(), tone: "positive" },
    { id: "draft", label: t("pub.mDraft"), value: services.filter((s) => s.status === "draft").length.toLocaleString() },
  ];

  const columns: DataTableColumn<ManagedService>[] = [
    {
      id: "svc",
      header: t("pub.cService"),
      cell: (s) => (
        <div>
          <div className="cell-asset-name">{s.name}</div>
          <div className="cell-asset-code">{s.code}</div>
        </div>
      ),
    },
    { id: "path", header: t("pub.cPath"), cell: (s) => <span className="dim" style={{ color: METHOD_COLOR[s.method] }}>{s.method}</span> },
    { id: "type", header: t("pub.cType"), cell: (s) => <span className="dim-tag">{t("type." + s.type)}</span> },
    { id: "level", header: t("pub.cLevel"), cell: (s) => <StatusBadge tone={LEVEL_TONE[s.level]}>{t("level." + s.level)}</StatusBadge> },
    { id: "datasets", header: t("pub.cDatasets"), align: "right", cell: (s) => s.datasetIds.length.toLocaleString() },
    {
      id: "status",
      header: t("pub.cStatus"),
      cell: (s) => {
        const st = STATUS_META[s.status] ?? { tone: "neutral" as const, icon: "pause" as const };
        return (
          <StatusBadge tone={st.tone}>
            <PIcon name={st.icon} /> {t("status." + s.status)}
          </StatusBadge>
        );
      },
    },
    ...(isAdmin
      ? [
          {
            id: "actions",
            header: "",
            align: "right",
            cell: (s: ManagedService) => (
              <span style={{ display: "inline-flex", gap: 4 }}>
                {s.status === "draft" && (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => publish(s.id)}>
                    {t("publishAction")}
                  </Button>
                )}
                {s.status === "running" && (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(() => unpublishDataService(s.id), "pub.unpublished")}>
                    {t("pub.unpublish")}
                  </Button>
                )}
                {s.status !== "running" && (
                  <>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => edit(s)}>
                      {t("pub.edit")}
                    </Button>
                    <button aria-label={t("pub.delete")} disabled={pending} onClick={() => act(() => deleteDataService(s.id), "pub.deleted")} style={{ border: 0, background: "none", cursor: "pointer", padding: 4, color: "inherit" }}>
                      <PIcon name="x" />
                    </button>
                  </>
                )}
              </span>
            ),
          } as DataTableColumn<ManagedService>,
        ]
      : []),
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="export" title={t("pub.title")} description={t("pub.desc")} />
      <MetricGrid items={metrics} />

      {msg && <p role="status" style={{ fontSize: 13, color: msg.tone === "ok" ? "var(--vx-color-success-600)" : "var(--vx-color-danger-600)" }}>{msg.text}</p>}

      {isAdmin && (
        <div className="con-card">
          <div className="con-card-hd">
            <div className="con-card-heading">{editingId ? t("pub.editTitle") : t("pub.newTitle")}</div>
            {editingId && (
              <Button size="sm" variant="ghost" onClick={reset}>
                {t("pub.cancel")}
              </Button>
            )}
          </div>
          <div className="pub-form">
            <Input value={form.name} maxLength={120} placeholder={t("pub.namePh")} onChange={(e) => set("name", e.target.value)} />
            <Input value={form.path} maxLength={200} placeholder={t("pub.pathPh")} onChange={(e) => set("path", e.target.value)} />
            <NativeSelect aria-label={t("pub.method")} value={form.method} onChange={(e) => set("method", e.target.value)}>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </NativeSelect>
            <NativeSelect aria-label={t("pub.type")} value={form.type} onChange={(e) => set("type", e.target.value)}>
              {TYPES.map((ty) => <option key={ty} value={ty}>{t("type." + ty)}</option>)}
            </NativeSelect>
            <NativeSelect aria-label={t("pub.level")} value={form.level} onChange={(e) => set("level", e.target.value)}>
              {LEVELS.map((l) => <option key={l} value={l}>{t("level." + l)}</option>)}
            </NativeSelect>
            <NativeSelect aria-label={t("pub.domain")} value={form.domain ?? ""} onChange={(e) => set("domain", e.target.value || null)}>
              <option value="">{t("pub.noDomain")}</option>
              {DOMAINS.map((d) => <option key={d} value={d}>{t("domain." + d)}</option>)}
            </NativeSelect>
            <Input value={form.description ?? ""} maxLength={500} placeholder={t("pub.descPh")} onChange={(e) => set("description", e.target.value || null)} />
            <NativeSelect
              aria-label={t("pub.addDataset")}
              value=""
              onChange={(e) => e.target.value && set("datasetIds", [...form.datasetIds, e.target.value])}
            >
              <option value="">{t("pub.addDataset")}</option>
              {available.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </NativeSelect>
          </div>
          {form.datasetIds.length > 0 && (
            <div className="tag-list" style={{ marginTop: "var(--vx-space-sm)" }}>
              {form.datasetIds.map((id) => (
                <span className="tag" key={id}>
                  <PIcon name="stack" /> {nameById.get(id) ?? id}
                  <button aria-label={t("pub.removeDataset")} onClick={() => set("datasetIds", form.datasetIds.filter((x) => x !== id))} style={{ border: 0, background: "none", cursor: "pointer", padding: "0 0 0 4px", color: "inherit" }}>
                    <PIcon name="x" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={{ marginTop: "var(--vx-space-md)" }}>
            <Button disabled={pending || !form.name.trim() || !form.path.trim()} onClick={submit}>
              <PIcon name={editingId ? "check" : "plus"} /> {editingId ? t("pub.save") : t("pub.create")}
            </Button>
          </div>
        </div>
      )}

      <div className="con-card no-pad">
        <div className="con-card-hd pad">
          <div className="con-card-heading">{t("pub.listTitle")}</div>
        </div>
        <DataTable columns={columns} rows={services} rowKey={(s) => s.id} empty={t("pub.empty")} />
      </div>
    </div>
  );
}
