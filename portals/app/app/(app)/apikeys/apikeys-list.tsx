"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Button,
  Checkbox,
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
  StatusBadge,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { API_SCOPES } from "../../lib/api/scopes";
import { PIcon } from "../../ui/phosphor-icon";
import { SectionHeading } from "../../ui/section-heading";
import { createApiKey, revokeApiKey, type CreateKeyResult } from "./actions";
import type { ApiKeyMetrics, ApiKeyView } from "./data";

const SCOPE_OPTIONS: readonly string[] = Object.values(API_SCOPES);

function fmtDate(iso: string | null, never: string): string {
  return iso ? new Date(iso).toLocaleString() : never;
}

export function ApiKeysList({ keys, metrics }: { keys: ApiKeyView[]; metrics: ApiKeyMetrics }) {
  const t = useTranslations("apikeys");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>([]);
  const [mintedToken, setMintedToken] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const toggleScope = (scope: string, on: boolean) => {
    setNewScopes((prev) => (on ? [...prev, scope] : prev.filter((s) => s !== scope)));
  };

  const mint = () => {
    setCreateErr(null);
    startTransition(async () => {
      const res: CreateKeyResult = await createApiKey({ name: newName, scopes: newScopes });
      if (res.ok) {
        setMintedToken(res.token);
        setNewName("");
        setNewScopes([]);
      } else {
        setCreateErr(t("create.error." + res.error));
      }
    });
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setMintedToken(null);
    setCreateErr(null);
    setNewScopes([]);
  };

  const revoke = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      await revokeApiKey(id);
      setBusyId(null);
    });
  };

  const metricItems: MetricGridItem[] = useMemo(
    () => [
      { id: "total", label: t("metrics.total"), value: metrics.total.toLocaleString() },
      { id: "active", label: t("metrics.active"), value: metrics.active.toLocaleString() },
      {
        id: "revoked",
        label: t("metrics.revoked"),
        value: metrics.revoked.toLocaleString(),
        tone: metrics.revoked ? "warning" : "default",
      },
    ],
    [metrics, t],
  );

  const columns: DataTableColumn<ApiKeyView>[] = [
    {
      id: "name",
      header: t("col.name"),
      cell: (k) => (
        <div>
          <div className="cell-asset-name">{k.name}</div>
          {k.consumerApp && <div className="cell-asset-code">{k.consumerApp}</div>}
        </div>
      ),
    },
    {
      id: "service",
      header: t("col.service"),
      cell: (k) => (k.serviceName ? <span className="dim-tag">{k.serviceName}</span> : <span className="dim">-</span>),
    },
    {
      id: "scopes",
      header: t("col.scopes"),
      cell: (k) => <span className="mono dim">{k.scopes.length ? k.scopes.join(", ") : "-"}</span>,
    },
    { id: "lastUsed", header: t("col.lastUsed"), cell: (k) => <span className="dim">{fmtDate(k.lastUsedAt, t("neverUsed"))}</span> },
    {
      id: "status",
      header: t("col.status"),
      cell: (k) => (
        <StatusBadge tone={k.revoked ? "neutral" : "success"}>{k.revoked ? t("status.revoked") : t("status.active")}</StatusBadge>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (k) =>
        k.revoked ? null : (
          <Button variant="secondary" size="sm" disabled={pending && busyId === k.id} onClick={() => revoke(k.id)}>
            <PIcon name="lock-key" /> {t("revoke")}
          </Button>
        ),
    },
  ];

  return (
    <div className="screen">
      <SectionHeading
        level="page"
        icon="lock-key"
        title={t("title")}
        description={t("description")}
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <PIcon name="plus" /> {t("create.button")}
          </Button>
        }
      />

      <MetricGrid items={metricItems} />

      {keys.length === 0 ? (
        <EmptyState
          title={
            <span className="app-empty-title">
              <PIcon name="lock-key" /> {t("emptyTitle")}
            </span>
          }
          description={t("emptyDesc")}
        />
      ) : (
        <div className="con-card no-pad">
          <div className="con-card-hd pad">
            <div className="con-card-heading">{t("listTitle")}</div>
          </div>
          <DataTable columns={columns} rows={keys} rowKey={(k) => k.id} />
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(o) => (o ? setCreateOpen(true) : closeCreate())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("create.title")}</DialogTitle>
            <DialogDescription>{t("create.desc")}</DialogDescription>
          </DialogHeader>

          {mintedToken ? (
            <div className="form-stack">
              <Label>{t("create.tokenLabel")}</Label>
              <code
                className="mono"
                style={{
                  display: "block",
                  padding: "8px 10px",
                  borderRadius: "var(--vx-radius-md)",
                  background: "var(--vx-color-surface-muted)",
                  wordBreak: "break-all",
                  userSelect: "all",
                }}
              >
                {mintedToken}
              </code>
              <p className="dim" style={{ fontSize: 12 }}>
                {t("create.tokenOnce")}
              </p>
            </div>
          ) : (
            <div className="form-stack">
              <div>
                <Label htmlFor="key-name">{t("create.name")}</Label>
                <Input id="key-name" value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <Label>{t("create.scopes")}</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {SCOPE_OPTIONS.map((scope) => (
                    <label key={scope} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <Checkbox
                        checked={newScopes.includes(scope)}
                        onCheckedChange={(on) => toggleScope(scope, on === true)}
                      />
                      <span className="mono" style={{ fontSize: 13 }}>
                        {scope}
                      </span>
                      <span className="dim" style={{ fontSize: 12 }}>
                        {t("create.scopeDesc." + scope.replace(":", "_"))}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="dim" style={{ fontSize: 12, marginTop: 6 }}>
                  {t("create.scopesHint")}
                </p>
              </div>
              {createErr && <p style={{ color: "var(--vx-color-danger-600)", fontSize: 13 }}>{createErr}</p>}
            </div>
          )}

          <DialogFooter>
            {mintedToken ? (
              <Button onClick={closeCreate}>{t("create.done")}</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={closeCreate}>
                  {t("create.cancel")}
                </Button>
                <Button disabled={pending || !newName.trim()} onClick={mint}>
                  {t("create.submit")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
