"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  NativeSelect,
} from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon, type PIconName } from "../../ui/phosphor-icon";
import { SectionHeading } from "../../ui/section-heading";
import { TYPE_META, type NodeType } from "./seed";
import { addLineageEdge, type AddEdgeResult } from "./actions";
import type { LineageView } from "./data";

const COL_W = 220;
const NODE_W = COL_W - 40;
const NODE_H = 64;
const GAP_Y = 26;
const PAD = 40;

export function LineageCanvas({ view, isAdmin = false }: { view: LineageView; isAdmin?: boolean }) {
  const t = useTranslations("lineage");
  const router = useRouter();
  const [linkOpen, setLinkOpen] = useState(false);
  const [up, setUp] = useState("");
  const [down, setDown] = useState("");
  const [transform, setTransform] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submitEdge = () => {
    setErr(null);
    startTransition(async () => {
      const res: AddEdgeResult = await addLineageEdge({
        upstreamDatasetId: up,
        downstreamDatasetId: down,
        transform,
      });
      if (res.ok) {
        setLinkOpen(false);
        setUp("");
        setDown("");
        setTransform("");
      } else {
        setErr(t("link.error." + res.error));
      }
    });
  };

  // Column-based layout: group nodes by col, vertically center each column.
  const cols: Record<number, LineageView["nodes"]> = {};
  let maxCol = 0;
  for (const n of view.nodes) {
    (cols[n.col] ??= []).push(n);
    maxCol = Math.max(maxCol, n.col);
  }
  const colHeight = (list: LineageView["nodes"]) => list.length * NODE_H + (list.length - 1) * GAP_Y;
  const maxH = view.nodes.length > 0 ? Math.max(...Object.values(cols).map(colHeight)) : NODE_H;
  const pos: Record<string, { x: number; y: number }> = {};
  for (let c = 0; c <= maxCol; c++) {
    const list = cols[c] ?? [];
    const startY = PAD + (maxH - colHeight(list)) / 2;
    list.forEach((n, i) => {
      pos[n.id] = { x: PAD + c * COL_W, y: startY + i * (NODE_H + GAP_Y) };
    });
  }
  const W = PAD * 2 + maxCol * COL_W + NODE_W;
  const H = maxH + PAD * 2;

  const TYPES: NodeType[] = ["source", "table", "api"];
  const subjectName = view.datasets.find((d) => d.id === view.subjectId)?.name ?? "-";

  return (
    <div className="screen">
      <SectionHeading
        level="page"
        icon="tree-structure"
        title={t("title")}
        description={t("description")}
        action={
          isAdmin ? (
            <Button onClick={() => setLinkOpen(true)}>
              <PIcon name="git-pull-request" /> {t("link.button")}
            </Button>
          ) : undefined
        }
      />

      <div className="lineage-toolbar">
        <span className="lt-label">{t("subject")}</span>
        <NativeSelect
          value={view.subjectId ?? ""}
          onChange={(e) => router.push(`/lineage?dataset=${encodeURIComponent(e.target.value)}`)}
          aria-label={t("subject")}
        >
          {view.datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
        <span className="lt-legend">
          {TYPES.map((ty) => (
            <span className="ltl-item" key={ty}>
              <span className="ltl-dot" style={{ background: TYPE_META[ty].color }} />
              {t("type." + ty)}
            </span>
          ))}
        </span>
      </div>

      {view.truncated && (
        <p className="dim" role="status" style={{ fontSize: 12 }}>
          {t("truncated")}
        </p>
      )}

      {view.nodes.length === 0 ? (
        <EmptyState
          title={
            <span className="app-empty-title">
              <PIcon name="tree-structure" /> {t("emptyTitle")}
            </span>
          }
          description={t("emptyDesc")}
        />
      ) : (
        <div className="con-card lineage-canvas" style={{ height: H + 24 }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
            {view.edges.map(([a, b], i) => {
              const p1 = pos[a];
              const p2 = pos[b];
              if (!p1 || !p2) return null;
              const x1 = p1.x + NODE_W;
              const y1 = p1.y + NODE_H / 2;
              const x2 = p2.x;
              const y2 = p2.y + NODE_H / 2;
              const mx = (x1 + x2) / 2;
              return (
                <path
                  key={i}
                  d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke="var(--vx-color-border-strong)"
                  strokeWidth="1.6"
                />
              );
            })}
          </svg>
          {view.nodes.map((n) => {
            const p = pos[n.id];
            const meta = TYPE_META[n.type];
            return (
              <div
                key={n.id}
                className={"ln-node" + (n.core ? " core" : "")}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
              >
                <span
                  className="ln-ico"
                  style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}
                >
                  <PIcon name={meta.icon as PIconName} />
                </span>
                <div className="ln-text">
                  <div className="ln-label">{n.label}</div>
                  <div className="ln-type">{t("type." + n.type)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="lineage-foot">
        <InfoChip icon="table" label={t("foot.subjectLabel")} value={subjectName} />
        <InfoChip
          icon="arrows-merge"
          label={t("foot.impactDatasets")}
          value={String(view.impact.datasets)}
          warn={view.impact.datasets > 0}
        />
        <InfoChip icon="broadcast" label={t("foot.impactServices")} value={String(view.impact.services)} />
        <InfoChip
          icon="warning"
          label={t("foot.impactNames")}
          value={view.impact.names.length > 0 ? view.impact.names.join(", ") : t("foot.none")}
        />
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("link.title")}</DialogTitle>
            <DialogDescription>{t("link.desc")}</DialogDescription>
          </DialogHeader>
          <div className="form-stack">
            <div>
              <Label htmlFor="ln-up">{t("link.upstream")}</Label>
              <NativeSelect id="ln-up" value={up} onChange={(e) => setUp(e.target.value)}>
                <option value="">-</option>
                {view.datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="ln-down">{t("link.downstream")}</Label>
              <NativeSelect id="ln-down" value={down} onChange={(e) => setDown(e.target.value)}>
                <option value="">-</option>
                {view.datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="ln-transform">{t("link.transform")}</Label>
              <Input id="ln-transform" value={transform} maxLength={200} onChange={(e) => setTransform(e.target.value)} />
            </div>
            {err && <p style={{ color: "var(--vx-color-danger-600)", fontSize: 13 }}>{err}</p>}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>
              {t("link.cancel")}
            </Button>
            <Button disabled={pending || !up || !down} onClick={submitEdge}>
              {t("link.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoChip({ icon, label, value, warn }: { icon: PIconName; label: string; value: string; warn?: boolean }) {
  return (
    <div className={"info-chip" + (warn ? " warn" : "")}>
      <PIcon name={icon} />
      <div>
        <div className="ic-label">{label}</div>
        <div className="ic-value">{value}</div>
      </div>
    </div>
  );
}
