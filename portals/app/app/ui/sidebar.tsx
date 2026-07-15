"use client";

import { useState } from "react";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon } from "./phosphor-icon";
import { BOARD_NAV, NAV_FLAT, BOARDS, PLAN_TAGS } from "./nav-config";
import { canUseFeature, minTierFor } from "../entitlement/capability";
import { SCREEN_FEATURES } from "../entitlement/screen-features";
import { useSubscription } from "../entitlement/gate";

interface SidebarProps {
  activeKey: string;
  onSelect: (route: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  /** Workspace admin (owner/admin role): shows role-locked nav groups. */
  isAdmin?: boolean;
}

/** Grouped, collapsible left navigation. No footer card - owner ruling. */
export function Sidebar({ activeKey, onSelect, collapsed, onToggle, isAdmin = false }: SidebarProps) {
  const tn = useTranslations("nav");
  const tg = useTranslations("navGroup");
  const tb = useTranslations("board");
  const ts = useTranslations("shell");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const subscription = useSubscription();

  // Visible-but-locked (owner ruling 2026-07-13): a screen above the current
  // tier keeps its nav entry and gets the required-tier badge; clicking it
  // opens the upgrade interstitial (ScreenGate), never hides or redirects.
  const lockedTierTag = (screenKey: string): string | null => {
    const feature = SCREEN_FEATURES[screenKey];
    if (!feature || !subscription || canUseFeature(subscription, feature)) return null;
    const tier = minTierFor(feature);
    return tier ? (PLAN_TAGS[tier] ?? tier.toUpperCase()) : null;
  };

  const activeBoard = BOARDS.find((b) => b.screens.includes(activeKey)) ?? BOARDS[0];
  const toggleSection = (g: string) => setClosed((s) => ({ ...s, [g]: !s[g] }));

  // Group-collapse-all affordance (parity with the vxture admin/console
  // shell): only worth showing once the nav has enough items to make
  // collapsing groups a real navigation aid.
  const domainNav = BOARD_NAV[activeBoard.id] ?? [];
  const visibleGroups = domainNav.filter((g) => !g.adminOnly || isAdmin);
  const totalItems = visibleGroups.flatMap((g) => g.items).length;
  const showCollapseAll = totalItems > 10;
  const allClosed = visibleGroups.every((g) => closed[g.key]);
  const toggleAll = () => {
    const next = !allClosed;
    const m: Record<string, boolean> = {};
    visibleGroups.forEach((g) => {
      m[g.key] = next;
    });
    setClosed(m);
  };

  return (
    <aside className={"sidebar" + (collapsed ? " is-collapsed" : "")}>
      <div className="side-rail">
        <button
          className="rail-toggle"
          onClick={onToggle}
          title={collapsed ? ts("navExpand") : ts("navCollapse")}
          aria-label={collapsed ? ts("navExpand") : ts("navCollapse")}
        >
          <PIcon name={collapsed ? "text-indent" : "text-outdent"} />
        </button>
        {!collapsed && (
          <span className="side-domain" title={tb(activeBoard.id)}>
            {tb(activeBoard.id)}
          </span>
        )}
        {!collapsed && showCollapseAll && (
          <button
            className="side-collapse-all"
            onClick={toggleAll}
            title={allClosed ? ts("navExpandAllGroups") : ts("navCollapseAllGroups")}
            aria-label={allClosed ? ts("navExpandAllGroups") : ts("navCollapseAllGroups")}
          >
            <PIcon name={allClosed ? "caret-double-down" : "caret-double-up"} />
          </button>
        )}
      </div>

      <nav className="side-nav" aria-label={ts("nav")}>
        {visibleGroups.map((group) => {
          const isClosed = !!closed[group.key];
          return (
            <section key={group.key} className="nav-section">
              <button
                className="nav-section-trigger"
                onClick={() => toggleSection(group.key)}
                aria-expanded={!isClosed}
              >
                {!collapsed && <span className="nav-section-title">{tg(group.key)}</span>}
                <PIcon className="nav-section-caret" name={isClosed ? "caret-right" : "caret-down"} />
              </button>
              {!isClosed && (
                <div className="nav-items">
                  {group.items.map((it) => {
                    const tierTag = lockedTierTag(it.key);
                    return (
                      <button
                        key={it.key}
                        className={"nav-item" + (activeKey === it.key ? " active" : "")}
                        onClick={() => onSelect(it.route)}
                        aria-label={tn(it.key)}
                        title={tn(it.key)}
                      >
                        <PIcon name={it.icon} />
                        <span className="nav-item-label">{tn(it.key)}</span>
                        {tierTag && !collapsed && <span className="nav-item-tag">{tierTag}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </nav>
    </aside>
  );
}

export { NAV_FLAT };
