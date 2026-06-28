"use client";

import { useState } from "react";
import { ShellFullscreenToggle, useTheme } from "@vxture/design-system";
import type { Locale, Theme } from "@vxture/shared";
import { persistTheme, type PrefTheme } from "@arda/shared/preferences";
import { useLocale } from "@arda/shared/locale-provider";
import { useTranslations } from "@arda/shared/i18n";
import { ARDA_LOCALE_OPTIONS } from "@arda/shared/locales";
import { PIcon } from "./phosphor-icon";
import { BOARDS, PLAN_TAGS, USER_LEVELS } from "./nav-config";

const PAGE_FULLSCREEN_ID = "arda-page-root";
const THEME_OPTIONS: Theme[] = ["system", "light", "dark"];

interface HeaderProps {
  activeKey: string;
  onSelect: (route: string) => void;
  onOpenNotifications: () => void;
  /** Subscription plan key (free | starter | pro | business | enterprise). */
  brandPlan?: string;
}

export function Header({ activeKey, onSelect, onOpenNotifications, brandPlan = "pro" }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const tb = useTranslations("brand");
  const th = useTranslations("header");
  const tboard = useTranslations("board");
  const tu = useTranslations("user");
  const tl = useTranslations("level");
  const [panel, setPanel] = useState<"launcher" | "user" | null>(null);

  const activeBoard = BOARDS.find((b) => b.screens.includes(activeKey)) ?? BOARDS[0];
  const toggle = (p: "launcher" | "user") => setPanel((cur) => (cur === p ? null : p));
  const planTag = brandPlan ? PLAN_TAGS[brandPlan] : undefined;
  const level = 5;
  const lv = USER_LEVELS[level];

  return (
    <div className="vxh">
      <div className="vxh-left">
        <div className="vxh-pop-anchor">
          <button
            className={"vxh-icon" + (panel === "launcher" ? " is-active" : "")}
            aria-label={th("launcher")}
            onClick={() => toggle("launcher")}
          >
            <PIcon name="dots-nine" />
          </button>
          {panel === "launcher" && (
            <div className="vxh-panel vxh-launcher-panel">
              <div className="vxh-board-list">
                {BOARDS.map((b) => (
                  <button
                    key={b.id}
                    className={"vxh-board" + (b.id === activeBoard.id ? " is-active" : "")}
                    onClick={() => {
                      setPanel(null);
                      onSelect("/" + b.home);
                    }}
                  >
                    <span className="vxh-board-ico">
                      <PIcon name={b.icon} />
                    </span>
                    <span className="vxh-board-copy">
                      <strong>{tboard(b.id)}</strong>
                      <span>{tboard(b.id + "Desc")}</span>
                    </span>
                    {b.id === activeBoard.id && <PIcon className="vxh-board-check" name="check" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <a
          className="vxh-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onSelect("/dashboard");
          }}
        >
          <span className="vxh-brand-name">{tb("name")}</span>
          {planTag && <span className={"vxh-brand-tag is-" + brandPlan}>{planTag}</span>}
        </a>

        <span className="vxh-divider" aria-hidden="true" />
      </div>

      <label className="vxh-search">
        <PIcon name="magnifying-glass" />
        <input type="search" placeholder={th("searchPlaceholder")} />
        <kbd>{"⌘K"}</kbd>
      </label>

      <div className="vxh-actions">
        <div className="vxh-group" role="group" aria-label={th("systemActions")}>
          <button className="vxh-icon" aria-label={th("help")}>
            <PIcon name="question" />
          </button>
          <button className="vxh-icon" aria-label={th("notifications")} onClick={onOpenNotifications}>
            <PIcon name="bell" />
            <span className="vxh-badge">12</span>
          </button>
          <button className="vxh-icon" aria-label={th("settings")}>
            <PIcon name="gear-six" />
          </button>
          <ShellFullscreenToggle
            targetId={PAGE_FULLSCREEN_ID}
            enterLabel={th("fullscreenEnter")}
            exitLabel={th("fullscreenExit")}
          />
        </div>

        <div className="vxh-pop-anchor">
          <button className="vxh-user" aria-label={tu("menu")} onClick={() => toggle("user")}>
            <span className="vxh-avatar">{tu("initial")}</span>
          </button>
          {panel === "user" && (
            <div className="vxh-panel vxh-user-panel">
              <div className="vxh-user-head">
                <span className="vxh-avatar xl">{tu("initial")}</span>
                <div>
                  <div className="vxh-user-name">
                    {tu("name")}
                    <span className="vxh-verify">
                      <PIcon name="seal-check" weight="fill" />
                      {tu("verified")}
                    </span>
                  </div>
                  <div className="vxh-user-contacts">
                    <span>{tu("email")}</span>
                  </div>
                </div>
              </div>

              <div className="vxh-level-row">
                <PIcon className="vxh-level-lead" name="medal" />
                <span className="vxh-lvslots">
                  <span className="vxh-lvslot is-earned" title={tu("role")}>
                    <PIcon name="users" weight="fill" />
                  </span>
                  <span className="vxh-lvslot is-earned" title={tl(lv.key)}>
                    <PIcon name={lv.icon} weight="fill" />
                  </span>
                  <span className="vxh-lvslot" title={tu("locked")}>
                    <PIcon name="medal" weight="fill" />
                  </span>
                </span>
              </div>

              <div className="vxh-divider-row" />

              <button className="vxh-acct-row">
                <PIcon name="user" />
                <span>{tu("profile")}</span>
                <PIcon className="vxh-acct-go" name="caret-right" />
              </button>
              <button className="vxh-acct-row">
                <PIcon name="buildings" />
                <span>{tu("tenantAdmin")}</span>
                <PIcon className="vxh-acct-go" name="caret-right" />
              </button>

              <div className="vxh-divider-row" />

              <div className="vxh-acct-row" role="group" aria-label={th("theme")}>
                <PIcon name="sun" />
                <span>{th("theme")}</span>
                <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      className={"pill" + (theme === opt ? " is-on" : "")}
                      onClick={() => {
                        setTheme(opt);
                        persistTheme(opt as PrefTheme);
                      }}
                    >
                      {th("theme_" + opt)}
                    </button>
                  ))}
                </span>
              </div>
              <div className="vxh-acct-row">
                <PIcon name="globe" />
                <span>{th("language")}</span>
                <select
                  style={{ marginLeft: "auto" }}
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                >
                  {ARDA_LOCALE_OPTIONS.map((o) => (
                    <option key={o.locale} value={o.locale}>
                      {o.nativeName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="vxh-divider-row" />

              <a className="vxh-menu-item danger" href="/auth/logout">
                <PIcon name="sign-out" />
                {tu("signOut")}
              </a>
            </div>
          )}
        </div>
      </div>

      {panel && <div className="vxh-backdrop" onClick={() => setPanel(null)} />}
    </div>
  );
}
