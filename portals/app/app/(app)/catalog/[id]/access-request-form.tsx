"use client";

import { useState, useTransition } from "react";
import { Button, Input, Textarea } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "../../../ui/phosphor-icon";
import { submitAccessRequest } from "./access-actions";

/** Interactive access-request form (Sec-BL4) - replaces the former static tab.
 *  Submits a pending request routed to the admin approval center. */
export function AccessRequestForm({ datasetId, assetName, level, owner }: { datasetId: string; assetName: string; level: string; owner: string | null }) {
  const t = useTranslations("catalog");
  const [pending, startTransition] = useTransition();
  const [useCase, setUseCase] = useState("");
  const [scope, setScope] = useState(t("access.scopeDefault"));
  const [justification, setJustification] = useState("");
  const [duration, setDuration] = useState(t("access.durationDefault"));
  const [method, setMethod] = useState("API");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const submit = () => {
    if (!useCase.trim() || !justification.trim()) return;
    setMsg(null);
    startTransition(async () => {
      const res = await submitAccessRequest({ datasetId, useCase, scope: scope || null, justification, duration: duration || null, method: method || null });
      if (res.ok) {
        setMsg({ tone: "ok", text: t("access.submitted") });
        setUseCase("");
        setJustification("");
      } else {
        setMsg({ tone: "err", text: t("access.error." + res.error) });
      }
    });
  };

  return (
    <div className="con-card">
      <div className="con-card-heading">{t("accessTitle", { name: assetName })}</div>
      <p className="form-hint">{t("accessHint", { level: t("level." + level), owner: owner ?? "-" })}</p>
      <div className="form-grid">
        <label className="field">
          <span>
            {t("access.useCase")}
            <i className="req">*</i>
          </span>
          <Input value={useCase} maxLength={200} placeholder={t("access.useCasePh")} onChange={(e) => setUseCase(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("access.scope")}</span>
          <Input value={scope} maxLength={200} onChange={(e) => setScope(e.target.value)} />
        </label>
        <label className="field span2">
          <span>
            {t("access.justification")}
            <i className="req">*</i>
          </span>
          <Textarea rows={3} value={justification} maxLength={1000} placeholder={t("access.justificationPh")} onChange={(e) => setJustification(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("access.duration")}</span>
          <Input value={duration} maxLength={60} onChange={(e) => setDuration(e.target.value)} />
        </label>
        <label className="field">
          <span>{t("access.method")}</span>
          <Input value={method} maxLength={40} onChange={(e) => setMethod(e.target.value)} />
        </label>
      </div>
      {msg && (
        <p role="status" style={{ fontSize: 13, color: msg.tone === "ok" ? "var(--vx-color-success-600)" : "var(--vx-color-danger-600)" }}>
          {msg.text}
        </p>
      )}
      <div className="form-foot">
        <Button disabled={pending || !useCase.trim() || !justification.trim()} onClick={submit}>
          <PIcon name="check" /> {t("access.submit")}
        </Button>
      </div>
    </div>
  );
}
