"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Drawer, ShellLegalFooter } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { ardaBrandCore } from "@arda/shared/brand";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { PIcon, type PIconName } from "./phosphor-icon";

/** Seed notifications (static demo data for Phase 1). */
const NOTIFS: Array<{ icon: PIconName; tone: string; key: string; route: string }> = [
  { icon: "warning-octagon", tone: "var(--vx-color-danger-600)", key: "n1", route: "/etl" },
  { icon: "warning", tone: "var(--vx-color-warning-500)", key: "n2", route: "/quality" },
  { icon: "lock-key-open", tone: "var(--vx-color-warning-500)", key: "n3", route: "/security" },
  { icon: "git-pull-request", tone: "var(--vx-color-info-600)", key: "n4", route: "/standards" },
];

/**
 * Console chrome: a fixed header (launcher + brand + search + actions + user
 * menu), a grouped collapsible left nav, the content column, and the DS legal
 * footer. Header/sidebar are arda-local compositions over DS tokens; the footer
 * and notifications drawer are DS components.
 */
export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const ts = useTranslations("shell");
  const tnotif = useTranslations("notif");
  const [isScrolled, setIsScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 50);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const activeKey = useMemo(() => (pathname ?? "/").split("/").filter(Boolean)[0] ?? "dashboard", [pathname]);

  return (
    <div id="arda-page-root" className="app-page">
      <header className={`app-header${isScrolled ? " is-scrolled" : ""}`}>
        <div className="app-header-inner">
          <Header
            activeKey={activeKey}
            onSelect={(route) => router.push(route)}
            onOpenNotifications={() => setNotifOpen(true)}
          />
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar" aria-label={ts("nav")}>
          <Sidebar
            activeKey={activeKey}
            onSelect={(route) => router.push(route)}
            collapsed={collapsed}
            onToggle={() => setCollapsed((c) => !c)}
          />
        </aside>
        <main className="app-main">{children}</main>
      </div>

      <ShellLegalFooter
        className="app-footer"
        innerClassName="app-footer-inner"
        copyright={ardaBrandCore.copyright}
        links={ardaBrandCore.legalLinks.map(([label, href]) => ({ label, href }))}
      />

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
