"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  MetricGrid,
  NativeSelect,
  PageHeader,
  StatusBadge,
  Textarea,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { canUseFeature, minTierFor } from "../../entitlement/capability";
import { useSubscription } from "../../entitlement/gate";
import { PLAN_TAGS } from "../../ui/nav-config";
import { registerDataSource, syncDataSource, type RegisterSourceResult, type SyncSourceResult } from "./actions";
import { SOURCE_TYPES } from "./source-types";
import type { DataSourceView, SourcesMetrics } from "./data";

const STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  connected: "success",
  degraded: "warning",
  disconnected: "neutral",
};

export function SourcesList({
  sources,
  metrics,
  isAdmin,
}: {
  sources: DataSourceView[];
  metrics: SourcesMetrics;
  isAdmin: boolean;
}) {
  const t = useTranslations("sources");
  const subscription = useSubscription();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("postgres");
  const [config, setConfig] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const atCap = metrics.max !== null && metrics.total >= metrics.max;

  const sync = (id: string) => {
    setSyncingId(id);
    setSyncMsg(null);
    startTransition(async () => {
      const res: SyncSourceResult = await syncDataSource(id);
      setSyncingId(null);
      if (res.ok) {
        setSyncMsg({
          tone: "ok",
          text: t("sync.done", {
            created: String(res.created),
            updated: String(res.updated),
          }) + (res.skippedByQuota > 0 ? " " + t("sync.skipped", { n: String(res.skippedByQuota) }) : ""),
        });
      } else {
        setSyncMsg({ tone: "err", text: t("sync.error." + res.error) + (res.reason ? ` (${res.reason})` : "") });
      }
    });
  };

  const premiumLocked = (premium: boolean) =>
    premium && subscription !== null && !canUseFeature(subscription, "arda.integration.sources_premium");

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res: RegisterSourceResult = await registerDataSource({ name, type, connectionJson: config });
      if (res.ok) {
        setOpen(false);
        setName("");
        setConfig("");
      } else {
        setError(t("error." + res.error));
      }
    });
  };

  const metricItems: MetricGridItem[] = [
    {
      id: "total",
      label: t("metrics.total"),
      value: metrics.max !== null ? `${metrics.total} / ${metrics.max}` : metrics.total.toLocaleString(),
      tone: atCap ? "warning" : "default",
    },
    { id: "connected", label: t("metrics.connected"), value: metrics.connected.toLocaleString() },
    { id: "datasets", label: t("metrics.datasets"), value: metrics.datasets.toLocaleString() },
  ];

  const columns: DataTableColumn<DataSourceView>[] = [
    {
      id: "name",
      header: t("col.name"),
      cell: (s) => (
        <div>
          <div className="cell-asset-name">{s.name}</div>
          <div className="cell-asset-code">{t("type." + s.type)}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: t("col.status"),
      cell: (s) => <StatusBadge tone={STATUS_TONE[s.status] ?? "neutral"}>{t("status." + s.status)}</StatusBadge>,
    },
    { id: "datasets", header: t("col.datasets"), align: "right", cell: (s) => s.datasetCount.toLocaleString() },
    {
      id: "config",
      header: t("col.credentials"),
      cell: (s) => <span className="dim">{s.hasConfig ? t("credentialsSealed") : "-"}</span>,
    },
    {
      id: "lastSynced",
      header: t("col.lastSynced"),
      cell: (s) => <span className="dim">{s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString() : t("neverSynced")}</span>,
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (s) =>
        isAdmin ? (
          <Button variant="secondary" size="sm" disabled={syncingId !== null} onClick={() => sync(s.id)}>
            <PIcon name="arrows-clockwise" /> {syncingId === s.id ? t("sync.running") : t("sync.run")}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="screen">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          isAdmin ? (
            <Button disabled={atCap} onClick={() => setOpen(true)} title={atCap ? t("error.quota") : undefined}>
              <PIcon name="plus" /> {t("register")}
            </Button>
          ) : undefined
        }
      />

      <MetricGrid items={metricItems} />

      {syncMsg && (
        <p
          role="status"
          style={{
            fontSize: 13,
            color: syncMsg.tone === "ok" ? "var(--vx-color-success-600)" : "var(--vx-color-danger-600)",
          }}
        >
          {syncMsg.text}
        </p>
      )}

      {sources.length === 0 ? (
        <EmptyState
          title={
            <span className="app-empty-title">
              <PIcon name="database" /> {t("emptyTitle")}
            </span>
          }
          description={t("emptyDesc")}
        />
      ) : (
        <div className="con-card no-pad">
          <div className="con-card-hd pad">
            <div className="con-card-heading">{t("listTitle")}</div>
          </div>
          <DataTable columns={columns} rows={sources} rowKey={(s) => s.id} />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("register")}</DialogTitle>
            <DialogDescription>{t("registerDesc")}</DialogDescription>
          </DialogHeader>

          <div className="form-stack">
            <div>
              <Label htmlFor="src-name">{t("form.name")}</Label>
              <Input id="src-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="src-type">{t("form.type")}</Label>
              <NativeSelect id="src-type" value={type} onChange={(e) => setType(e.target.value)}>
                {SOURCE_TYPES.map((s) => (
                  <option key={s.type} value={s.type} disabled={premiumLocked(s.premium)}>
                    {t("type." + s.type)}
                    {s.premium ? ` (${PLAN_TAGS[minTierFor("arda.integration.sources_premium") ?? "pro"]})` : ""}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="src-config">{t("form.config")}</Label>
              <Textarea
                id="src-config"
                rows={4}
                placeholder={t("form.configPlaceholder")}
                value={config}
                onChange={(e) => setConfig(e.target.value)}
              />
              <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                {t("form.configHint")}
              </p>
            </div>
            {error && <p style={{ color: "var(--vx-color-danger-600)", fontSize: 13 }}>{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("form.cancel")}
            </Button>
            <Button disabled={pending || !name.trim()} onClick={submit}>
              {t("form.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
