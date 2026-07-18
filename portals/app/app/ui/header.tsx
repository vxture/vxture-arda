"use client";

import { useEffect, useState } from "react";
import { ShellFullscreenToggle, useTheme } from "@vxture/design-system";
import type { Locale, Theme } from "@vxture/shared";
import {
  persistTheme,
  persistDensity,
  persistFontSize,
  getFontSize,
  type PrefTheme,
  type PrefDensity,
  type PrefFontSize,
} from "@arda/shared/preferences";
import { useLocale } from "@arda/shared/locale-provider";
import { useTranslations } from "@arda/shared/i18n";
import { ARDA_LOCALE_OPTIONS } from "@arda/shared/locales";
import { PIcon } from "./phosphor-icon";
import { BOARDS, LAUNCHER_GROUPS, PLAN_TAGS, ROUTE_BY_KEY, USER_LEVELS } from "./nav-config";

const PAGE_FULLSCREEN_ID = "arda-page-root";
const THEME_OPTIONS: Theme[] = ["system", "light", "dark"];
const DENSITY_OPTIONS: PrefDensity[] = ["compact", "default", "comfortable"];
const FONTSIZE_OPTIONS: PrefFontSize[] = ["small", "default", "large"];

/** Full-width segmented control used in the preferences block. */
function PrefSeg<T extends string>({
  icon,
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  icon: "sun" | "rows" | "text-aa";
  label: string;
  value: T;
  options: readonly T[];
  optionLabel: (opt: T) => string;
  onChange: (opt: T) => void;
}) {
  return (
    <div className="vxh-pref-row" aria-label={label}>
      <PIcon className="vxh-pref-ico" name={icon} />
      <div className="vxh-seg full">
        {options.map((opt) => (
          <button key={opt} className={value === opt ? "on" : ""} onClick={() => onChange(opt)}>
            {optionLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

interface HeaderProps {
  activeKey: string;
  onSelect: (route: string) => void;
  onOpenNotifications: () => void;
  /** Toggle the Varda assistant panel. */
  onToggleAssistant?: () => void;
  /** Whether the Varda assistant panel is open (for the entry button state). */
  assistantOpen?: boolean;
  /** Subscription plan key (free | starter | pro | business | enterprise). */
  brandPlan?: string;
  /** Workspace admin (owner/admin role): shows role-locked boards (admin). */
  isAdmin?: boolean;
}

export function Header({
  activeKey,
  onSelect,
  onOpenNotifications,
  onToggleAssistant,
  assistantOpen,
  brandPlan,
  isAdmin = false,
}: HeaderProps) {
  const { theme, setTheme, density, setDensity } = useTheme();
  const { locale, setLocale } = useLocale();
  const [fontSize, setFontSize] = useState<PrefFontSize>("default");
  useEffect(() => setFontSize(getFontSize()), []);
  const tb = useTranslations("brand");
  const th = useTranslations("header");
  const tboard = useTranslations("board");
  const tlg = useTranslations("launcherGroup");
  const tu = useTranslations("user");
  const tl = useTranslations("level");
  const [panel, setPanel] = useState<"launcher" | "user" | null>(null);

  // The admin board is visible to every member since it now hosts the
  // approval center (my requests); its role-locked GROUPS stay hidden for
  // non-admins in the sidebar (biz-250 §6 still applies at group level).
  const boards = BOARDS;
  void isAdmin;
  const activeBoard = boards.find((b) => b.screens.includes(activeKey)) ?? boards[0];
  const toggle = (p: "launcher" | "user") => setPanel((cur) => (cur === p ? null : p));
  const planTag = brandPlan ? PLAN_TAGS[brandPlan] : undefined;
  const level = 5;
  const lv = USER_LEVELS[level];

  return (
    <header className="vxh">
      <div className="vxh-left">
        <div className="vxh-pop-anchor">
          <button
            className={"vxh-icon vxh-launcher" + (panel === "launcher" ? " is-active" : "")}
            aria-label={th("launcher")}
            onClick={() => toggle("launcher")}
          >
            <PIcon name="dots-nine" />
          </button>
          {panel === "launcher" && (
            <div className="vxh-panel vxh-launcher-panel is-grid">
              <div className="vxh-launcher-grid">
                {LAUNCHER_GROUPS.map((g) => (
                  <div className="vxh-board-col" key={g.key}>
                    <div className="vxh-board-col-title">{tlg(g.key)}</div>
                    {boards
                      .filter((b) => b.group === g.key)
                      .map((b) => (
                        <button
                          key={b.id}
                          className={"vxh-board" + (b.id === activeBoard.id ? " is-active" : "")}
                          title={tboard(b.id + "Desc")}
                          onClick={() => {
                            setPanel(null);
                            onSelect(ROUTE_BY_KEY[b.home] ?? "/" + b.home);
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

        {/* Current functional domain (non-interactive), matching the vxture
            admin shell's .vxh-active-menu position. */}
        <span className="vxh-active-menu">
          <span>{tboard(activeBoard.id)}</span>
        </span>
      </div>

      <label className="vxh-search">
        <PIcon name="magnifying-glass" />
        <input type="search" placeholder={th("searchPlaceholder")} />
        <kbd>{"⌘K"}</kbd>
      </label>

      <div className="vxh-actions">
        {onToggleAssistant && (
          <button
            className={"vxh-agent" + (assistantOpen ? " is-active" : "")}
            aria-label={th("assistant")}
            aria-pressed={assistantOpen}
            onClick={onToggleAssistant}
          >
            <PIcon name="sparkle" weight="fill" />
          </button>
        )}

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
                <div className="vxh-user-meta">
                  <div className="vxh-user-name">
                    {tu("name")}
                    <span className="vxh-verify">
                      <PIcon name="seal-check" weight="fill" />
                      {tu("verified")}
                    </span>
                  </div>
                  <div className="vxh-user-contacts">
                    <span className="vxh-user-contact">{tu("email")}</span>
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

              <div className="vxh-acct-div" />

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

              <div className="vxh-acct-div" />

              <div className="vxh-prefs">
                <div className="vxh-prefs-title">{th("prefs")}</div>
                <div className="vxh-pref-row" aria-label={th("language")}>
                  <PIcon className="vxh-pref-ico" name="globe" />
                  <select
                    className="vxh-pref-select"
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
                <PrefSeg
                  icon="sun"
                  label={th("theme")}
                  value={theme}
                  options={THEME_OPTIONS}
                  optionLabel={(opt) => th("theme_" + opt)}
                  onChange={(opt) => {
                    setTheme(opt);
                    persistTheme(opt as PrefTheme);
                  }}
                />
                <PrefSeg
                  icon="rows"
                  label={th("density")}
                  value={density}
                  options={DENSITY_OPTIONS}
                  optionLabel={(opt) => th("density_" + opt)}
                  onChange={(opt) => {
                    setDensity(opt);
                    persistDensity(opt);
                  }}
                />
                <PrefSeg
                  icon="text-aa"
                  label={th("fontSize")}
                  value={fontSize}
                  options={FONTSIZE_OPTIONS}
                  optionLabel={(opt) => th("fontSize_" + opt)}
                  onChange={(opt) => {
                    setFontSize(opt);
                    persistFontSize(opt);
                  }}
                />
              </div>

              <div className="vxh-acct-div" />

              <div className="vxh-user-actions">
                <a className="vxh-menu-item danger" href="/auth/logout">
                  <PIcon name="sign-out" />
                  {tu("signOut")}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {panel && <div className="vxh-backdrop" onClick={() => setPanel(null)} />}
    </header>
  );
}
