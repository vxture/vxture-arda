"use client";

import { useState } from "react";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "./phosphor-icon";

/**
 * arda Curator panel (design source `Assistant` / `vela-*`; renamed from
 * "Varda" per ADR-013 2026-07-28 - see docs/30-design/arda_biz_270_curator.md).
 *
 * A first-class right-docked AI surface, not a mere entry button. Three display
 * modes mirror the design: `narrow` (default), `wide` (widens the panel, the
 * shell auto-collapses the nav), and `full` (overlay). The seeded thread shows
 * the three message kinds the product is built around: user prompt, AI answer
 * (with follow-up suggestions), and a tool-call block (name + args + result +
 * latency). Content is generic (no domain-specific seed) and i18n-driven.
 */
export type AssistantMode = "narrow" | "wide" | "full";

interface AssistantProps {
  mode: AssistantMode;
  onClose: () => void;
  onToggleWide: () => void;
  onToggleFull: () => void;
}

/** Model label shown in the assistant badge. */
const MODEL_LABEL = "claude-sonnet-4-6";

export function Assistant({ mode, onClose, onToggleWide, onToggleFull }: AssistantProps) {
  const t = useTranslations("assistant");
  const [input, setInput] = useState("");

  return (
    <aside
      className={"assistant" + (mode === "wide" ? " is-wide" : "") + (mode === "full" ? " is-full" : "")}
      aria-label={t("title")}
    >
      <div className="vela-hd">
        <span className="vela-mark">
          <PIcon name="sparkle" weight="fill" />
        </span>
        <div className="vela-hd-text">
          <div className="vela-title">
            {t("title")}
            <span className="vela-mb">
              <span className="vela-mb-dot" />
              {MODEL_LABEL}
            </span>
          </div>
          <div className="vela-sub">{t("subtitle")}</div>
        </div>
        {mode !== "full" && (
          <button
            className="vela-hd-btn"
            onClick={onToggleWide}
            aria-label={mode === "wide" ? t("narrow") : t("widen")}
          >
            <PIcon name={mode === "wide" ? "arrow-line-right" : "arrow-line-left"} />
          </button>
        )}
        <button
          className="vela-hd-btn"
          onClick={onToggleFull}
          aria-label={mode === "full" ? t("exitFull") : t("full")}
        >
          <PIcon name={mode === "full" ? "corners-in" : "corners-out"} />
        </button>
        <button className="vela-close" onClick={onClose} aria-label={t("close")}>
          <PIcon name="x" />
        </button>
      </div>

      <div className="vela-body">
        <div className="vela-row">
          <span className="vela-am">
            <PIcon name="sparkle" weight="fill" />
          </span>
          <div className="vela-ai-wrap">
            <div className="vela-bub ai">{t("greeting")}</div>
          </div>
        </div>

        <div className="vela-bub user">{t("q1")}</div>

        <div className="vela-row">
          <span className="vela-am">
            <PIcon name="sparkle" weight="fill" />
          </span>
          <div className="vela-tool">
            <div className="vt-head">
              <PIcon name="wrench" />
              <strong>{t("toolName")}</strong>
              <span className="vt-ok">{"✓ 18ms"}</span>
            </div>
            <div className="vt-arg">{t("toolArg")}</div>
            <div className="vt-res">{"→ " + t("toolRes")}</div>
          </div>
        </div>

        <div className="vela-row">
          <span className="vela-am">
            <PIcon name="sparkle" weight="fill" />
          </span>
          <div className="vela-ai-wrap">
            <div className="vela-bub ai">{t("a1")}</div>
            <div className="vela-sugs">
              <button className="vela-sug">{t("sug1")}</button>
              <button className="vela-sug">{t("sug2")}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="vela-ft">
        <div className="vela-input">
          <textarea
            rows={1}
            value={input}
            placeholder={t("inputPlaceholder")}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="vela-send" aria-label={t("send")}>
            <PIcon name="arrow-up" weight="fill" />
          </button>
        </div>
        <div className="vela-ft-meta">
          <span className="vela-mb">
            <span className="vela-mb-dot" />
            {MODEL_LABEL}
          </span>
          <span>{t("authorized")}</span>
        </div>
      </div>
    </aside>
  );
}
