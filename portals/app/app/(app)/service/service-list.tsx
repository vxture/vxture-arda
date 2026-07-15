"use client";

import { useState, useTransition } from "react";
import { Button, EmptyState, MetricGrid, StatusBadge, type MetricGridItem } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../ui/phosphor-icon";
import { SectionHeading } from "../../ui/section-heading";
import { DOMAINS, LEVEL_TONE, METHOD_COLOR, STATUS_META } from "./seed";
import { publishDataService, type PublishServiceResult } from "./actions";
import type { ServiceView } from "./data";

export function ServiceList({ services, isAdmin = false }: { services: ServiceView[]; isAdmin?: boolean }) {
  const t = useTranslations("service");
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const publish = (id: string) => {
    setBusyId(id);
    setMsg(null);
    startTransition(async () => {
      const res: PublishServiceResult = await publishDataService(id);
      setBusyId(null);
      if (res.ok) {
        setMsg({
          tone: "ok",
          text:
            t("publishDone") +
            (res.warnings.length > 0 ? " " + t("publishWarn", { n: String(res.warnings.length) }) : ""),
        });
      } else if (res.error === "quality") {
        const names = (res.blockers ?? []).map((b) => `${b.datasetName}: ${b.ruleName}`).join("; ");
        setMsg({ tone: "err", text: t("publishBlocked", { blockers: names }) });
      } else {
        setMsg({ tone: "err", text: t("publishError." + res.error) });
      }
    });
  };

  const running = services.filter((s) => s.status === "running").length;
  const metrics: MetricGridItem[] = [
    { id: "online", label: t("metrics.online"), value: running.toString(), tone: "positive" },
    { id: "calls", label: t("metrics.calls"), value: "1.98M", trend: t("metrics.callsTrend"), tone: "positive" },
    { id: "p99", label: t("metrics.p99"), value: "96ms", tone: "positive" },
    { id: "sla", label: t("metrics.sla"), value: "99.93%" },
  ];

  return (
    <div className="screen">
      <SectionHeading
        level="page"
        icon="broadcast"
        title={t("title")}
        description={t("description")}
        action={
          <>
            <Button variant="secondary">
              <PIcon name="book-open" /> {t("docs")}
            </Button>
            <Button>
              <PIcon name="plus" /> {t("publish")}
            </Button>
          </>
        }
      />

      <MetricGrid items={metrics} />

      {msg && (
        <p
          role="status"
          style={{
            fontSize: 13,
            color: msg.tone === "ok" ? "var(--vx-color-success-600)" : "var(--vx-color-danger-600)",
          }}
        >
          {msg.text}
        </p>
      )}

      {services.length === 0 ? (
        <EmptyState
          title={
            <span className="app-empty-title">
              <PIcon name="broadcast" /> {t("emptyTitle")}
            </span>
          }
          description={t("emptyDesc")}
        />
      ) : (
        <div className="service-grid">
          {services.map((s) => {
            const dom = s.domain ? DOMAINS[s.domain] : undefined;
            const st = STATUS_META[s.status] ?? STATUS_META.paused;
            return (
              <div className="service-card" key={s.id}>
                <div className="sc-top">
                  <span className="sc-method" style={{ color: METHOD_COLOR[s.method] ?? "var(--vx-color-text-muted)" }}>
                    {s.method}
                  </span>
                  <StatusBadge tone={st.tone}>
                    <PIcon name={st.icon} /> {t("status." + s.status)}
                  </StatusBadge>
                </div>
                <div className="sc-name">{s.name}</div>
                <div className="sc-path">{s.path}</div>
                {s.description && <div className="sc-desc">{s.description}</div>}
                <div className="sc-tags">
                  {s.domain && (
                    <span className="tag" style={{ color: dom?.color }}>
                      <PIcon name={dom?.icon ?? "broadcast"} /> {t("domain." + s.domain)}
                    </span>
                  )}
                  <StatusBadge tone={LEVEL_TONE[s.level]}>{t("level." + s.level)}</StatusBadge>
                </div>
                {isAdmin && s.status === "draft" && (
                  <div style={{ marginTop: 8 }}>
                    <Button size="sm" disabled={pending && busyId === s.id} onClick={() => publish(s.id)}>
                      <PIcon name="broadcast" /> {t("publishAction")}
                    </Button>
                  </div>
                )}
                <div className="sc-stats">
                  <div>
                    <span className="scs-val dim">-</span>
                    <span className="scs-label">{t("stat.calls")}</span>
                  </div>
                  <div>
                    <span className="scs-val dim">-</span>
                    <span className="scs-label">P99</span>
                  </div>
                  <div>
                    <span className="scs-val dim">-</span>
                    <span className="scs-label">SLA</span>
                  </div>
                  <div>
                    <span className="scs-val dim">-</span>
                    <span className="scs-label">{t("stat.subs")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
