"use client";

import { useState, useTransition } from "react";
import {
  Button,
  DataTable,
  MetricGrid,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type DataTableColumn,
  type MetricGridItem,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { SectionHeading } from "../../ui/section-heading";
import { cancelRequest, decideRequest } from "./actions";
import type { ApprovalData, RequestView } from "./data";

const STATUS_TONE: Record<string, "warning" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

function fmt(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

/** Approval center (Sec-BL4): approver queue + my requests. */
export function ApprovalsView({ data, isAdmin = false }: { data: ApprovalData; isAdmin?: boolean }) {
  const t = useTranslations("approvals");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okKey: string) => {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? { tone: "ok", text: t(okKey) } : { tone: "err", text: t("error." + res.error) });
    });
  };

  const requesterCol: DataTableColumn<RequestView> = {
    id: "who",
    header: t("cRequester"),
    cell: (r) => (
      <div>
        <div className="cell-asset-name">{r.requesterName}</div>
        <div className="cell-asset-code">{r.datasetName ?? t("noDataset")}</div>
      </div>
    ),
  };
  const useCaseCol: DataTableColumn<RequestView> = { id: "useCase", header: t("cUseCase"), cell: (r) => <span title={r.justification}>{r.useCase}</span> };
  const statusCol: DataTableColumn<RequestView> = {
    id: "status",
    header: t("cStatus"),
    cell: (r) => <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"}>{t("status." + r.status)}</StatusBadge>,
  };
  const whenCol: DataTableColumn<RequestView> = { id: "when", header: t("cWhen"), cell: (r) => <span className="dim">{fmt(r.createdAt)}</span> };

  const pendingCols: DataTableColumn<RequestView>[] = [
    requesterCol,
    useCaseCol,
    { id: "dur", header: t("cDuration"), cell: (r) => r.duration ?? "-" },
    whenCol,
    {
      id: "act",
      header: "",
      align: "right",
      cell: (r) => (
        <span style={{ display: "inline-flex", gap: 4 }}>
          <Button size="sm" disabled={pending} onClick={() => run(() => decideRequest(r.id, true), "approved")}>
            {t("approve")}
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => decideRequest(r.id, false), "rejected")}>
            {t("reject")}
          </Button>
        </span>
      ),
    },
  ];

  const mineCols: DataTableColumn<RequestView>[] = [
    { id: "asset", header: t("cAsset"), cell: (r) => r.datasetName ?? t("noDataset") },
    useCaseCol,
    statusCol,
    whenCol,
    {
      id: "act",
      header: "",
      align: "right",
      cell: (r) =>
        r.status === "pending" ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => cancelRequest(r.id), "cancelled")}>
            {t("cancel")}
          </Button>
        ) : (
          <span className="dim">{r.decisionNote ?? ""}</span>
        ),
    },
  ];

  const metrics: MetricGridItem[] = [
    ...(isAdmin ? [{ id: "pending", label: t("mPending"), value: data.pendingCount.toLocaleString(), tone: data.pendingCount ? ("warning" as const) : ("default" as const) }] : []),
    { id: "mine", label: t("mMine"), value: data.mine.length.toLocaleString() },
    { id: "open", label: t("mMyOpen"), value: data.mine.filter((r) => r.status === "pending").length.toLocaleString() },
  ];

  return (
    <div className="screen">
      <SectionHeading level="page" icon="stamp" title={t("title")} description={t("desc")} />
      <MetricGrid items={metrics} />
      {msg && <p role="status" style={{ fontSize: 13, color: msg.tone === "ok" ? "var(--vx-color-success-600)" : "var(--vx-color-danger-600)" }}>{msg.text}</p>}

      <Tabs defaultValue={isAdmin ? "pending" : "mine"}>
        <TabsList>
          {isAdmin && (
            <TabsTrigger value="pending">
              {t("tabPending")} {data.pendingCount > 0 && <span className="nav-item-tag">{data.pendingCount}</span>}
            </TabsTrigger>
          )}
          <TabsTrigger value="mine">{t("tabMine")}</TabsTrigger>
        </TabsList>
        {isAdmin && (
          <TabsContent value="pending">
            <div className="con-card no-pad">
              <DataTable columns={pendingCols} rows={data.pending} rowKey={(r) => r.id} empty={t("emptyPending")} />
            </div>
          </TabsContent>
        )}
        <TabsContent value="mine">
          <div className="con-card no-pad">
            <DataTable columns={mineCols} rows={data.mine} rowKey={(r) => r.id} empty={t("emptyMine")} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
