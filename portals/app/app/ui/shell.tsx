"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Drawer } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { NAV_FLAT } from "./nav-config";
import { Assistant, type AssistantMode } from "./assistant";
import { PIcon, type PIconName } from "./phosphor-icon";
import { useSubscription } from "../entitlement/gate";

/** Seed notifications (static demo data for Phase 1). */
const NOTIFS: Array<{ icon: PIconName; tone: string; key: string; route: string }> = [
  { icon: "warning-octagon", tone: "var(--vx-color-danger-600)", key: "n1", route: "/etl" },
  { icon: "warning", tone: "var(--vx-color-warning-500)", key: "n2", route: "/quality" },
  { icon: "lock-key-open", tone: "var(--vx-color-warning-500)", key: "n3", route: "/security" },
  { icon: "git-pull-request", tone: "var(--vx-color-info-600)", key: "n4", route: "/standards" },
];

/**
 * Console chrome: an in-flow header (launcher + brand + search + actions +
 * user menu), a grouped collapsible left nav, and a single scrolling content
 * column - a values-exact port of the vxture admin/console shared shell (see
 * globals.css header comment). Header/sidebar are arda-local compositions
 * over DS tokens; the notifications drawer is a DS component. No page
 * footer - owner ruling, dropped app-wide.
 */
export function Shell({ children, isAdmin = false }: { children: ReactNode; isAdmin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const tnotif = useTranslations("notif");
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("narrow");
  // Real subscription from the gate context: the header plan tag shows the
  // workspace's actual tier (SaaS display ends at business; "ENT" appears only
  // in private deployments where the license sets tier=enterprise).
  const subscription = useSubscription();

  const toggleAssistantWide = () => {
    setAssistantMode((m) => {
      const next = m === "wide" ? "narrow" : "wide";
      if (next === "wide") setCollapsed(true); // wide auto-collapses the nav
      return next;
    });
  };
  const toggleAssistantFull = () => setAssistantMode((m) => (m === "full" ? "narrow" : "full"));
  const closeAssistant = () => {
    setAssistantOpen(false);
    setAssistantMode("narrow");
  };

  // Longest-route-prefix match over the flat nav: exact route wins, otherwise
  // the deepest ancestor route (so /catalog/[id] highlights "catalog" while
  // /catalog/inventory highlights its own entry).
  const activeKey = useMemo(() => {
    const path = pathname ?? "/";
    let best: { key: string; len: number } | null = null;
    for (const item of NAV_FLAT) {
      if (path === item.route || path.startsWith(item.route + "/")) {
        if (!best || item.route.length > best.len) best = { key: item.key, len: item.route.length };
      }
    }
    return best?.key ?? "dashboard";
  }, [pathname]);

  const rootClass = "app" + (assistantOpen ? " vela-open vela-" + assistantMode : "");

  return (
    <div id="arda-page-root" className={rootClass}>
      <Header
        activeKey={activeKey}
        onSelect={(route) => router.push(route)}
        onOpenNotifications={() => setNotifOpen(true)}
        onToggleAssistant={() => setAssistantOpen((o) => !o)}
        assistantOpen={assistantOpen}
        brandPlan={subscription?.tier ?? undefined}
        isAdmin={isAdmin}
      />

      <div className="app-body">
        <Sidebar
          activeKey={activeKey}
          onSelect={(route) => router.push(route)}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          isAdmin={isAdmin}
        />
        <main className="content-scroll">
          <div className="content-inner">{children}</div>
        </main>
      </div>

      {assistantOpen && (
        <Assistant
          mode={assistantMode}
          onClose={closeAssistant}
          onToggleWide={toggleAssistantWide}
          onToggleFull={toggleAssistantFull}
        />
      )}

      <Drawer open={notifOpen} onClose={() => setNotifOpen(false)} side="right" title={tnotif("title")}>
        <div className="alert-list">
          {NOTIFS.map((n) => (
            <button
              key={n.key}
              className="alert-item"
              onClick={() => {
                setNotifOpen(false);
                router.push(n.route);
              }}
            >
              <span
                className="alert-ico"
                style={{ color: n.tone, background: `color-mix(in srgb, ${n.tone} 14%, transparent)` }}
              >
                <PIcon name={n.icon} weight="fill" />
              </span>
              <span>
                <span className="alert-title">{tnotif(n.key + "Title")}</span>
                <span className="alert-meta" style={{ display: "block" }}>
                  {tnotif(n.key + "Meta")}
                </span>
              </span>
              <PIcon className="alert-caret" name="caret-right" />
            </button>
          ))}
        </div>
      </Drawer>
    </div>
  );
}
