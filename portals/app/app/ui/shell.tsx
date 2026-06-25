"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  SectionNav,
  ShellBrand,
  ShellFullscreenToggle,
  ShellLegalFooter,
  ShellLocaleSwitcher,
  ShellThemeToggle,
  useTheme,
  type SectionNavItem,
} from "@vxture/design-system";
import type { Locale } from "@vxture/shared";
import { persistTheme, type PrefTheme } from "@arda/shared/preferences";
import { useLocale } from "@arda/shared/locale-provider";
import { useTranslations } from "@arda/shared/i18n";
import { ARDA_LOCALE_OPTIONS } from "@arda/shared/locales";
import { ardaBrandCore } from "@arda/shared/brand";

/** Element the fullscreen toggle expands; the page root carries this id. */
const PAGE_FULLSCREEN_ID = "arda-page-root";

/** Section key -> destination route. Only data-assets is a real surface; the
 *  rest are placeholder pages. The first path segment is the active section. */
const SECTION_ROUTES: Record<string, string> = {
  "data-assets": "/data-assets/overview",
  integration: "/integration",
  management: "/management",
  governance: "/governance",
  services: "/services",
};

const SECTION_KEYS = [
  "data-assets",
  "integration",
  "management",
  "governance",
  "services",
] as const;

/**
 * App chrome: a fixed brand/header bar, a left section navigation listing the
 * five platform sections, and a content column. All primitives (header tools,
 * nav, footer) are DS components; this file only composes layout.
 */
export function Shell({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const th = useTranslations("header");
  const tn = useTranslations("nav");
  const tb = useTranslations("brand");
  const router = useRouter();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 50);
    update();
    window.addEventListener("scroll", update);
    return () => window.removeEventListener("scroll", update);
  }, []);

  // Active section = first path segment (e.g. /data-assets/overview -> data-assets).
  const activeKey = useMemo(() => {
    const seg = (pathname ?? "/").split("/").filter(Boolean)[0] ?? "data-assets";
    return seg in SECTION_ROUTES ? seg : "data-assets";
  }, [pathname]);

  const navItems: SectionNavItem[] = SECTION_KEYS.map((key) => ({
    key,
    label: tn(camelKey(key)),
  }));

  return (
    <div id={PAGE_FULLSCREEN_ID} className="app-page">
      <header className={`app-header${isScrolled ? " is-scrolled" : ""}`}>
        <div className="app-header-inner">
          <ShellBrand
            href={ardaBrandCore.siteUrl}
            label={
              <span className="app-brand-lockup">
                <span className="app-brand-name">{tb("name")}</span>
                <span className="app-brand-tag">{tb("tag")}</span>
              </span>
            }
          />
          <div
            className="app-header-actions"
            role="group"
            aria-label={th("display")}
          >
            <ShellThemeToggle
              currentTheme={theme}
              buttonLabel={th("theme")}
              onThemeChange={(next) => {
                setTheme(next);
                persistTheme(next as PrefTheme);
              }}
            />
            <ShellLocaleSwitcher
              currentLocale={locale as Locale}
              options={ARDA_LOCALE_OPTIONS}
              buttonLabel={th("language")}
              onLocaleChange={(next) => setLocale(next)}
            />
            <ShellFullscreenToggle
              targetId={PAGE_FULLSCREEN_ID}
              enterLabel={th("fullscreenEnter")}
              exitLabel={th("fullscreenExit")}
            />
          </div>
        </div>
      </header>

      <div className="app-body">
        <aside className="app-sidebar" aria-label={th("nav")}>
          <SectionNav
            items={navItems}
            activeKey={activeKey}
            onSelect={(key) => router.push(SECTION_ROUTES[key])}
          />
        </aside>

        <main className="app-main">{children}</main>
      </div>

      <ShellLegalFooter
        className="app-footer"
        innerClassName="app-footer-inner"
        copyright={ardaBrandCore.copyright}
        links={ardaBrandCore.legalLinks.map(([label, href]) => ({
          label,
          href,
        }))}
      />
    </div>
  );
}

/** Map a kebab section key to its camelCase i18n key (data-assets -> dataAssets). */
function camelKey(key: string): string {
  return key.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}
