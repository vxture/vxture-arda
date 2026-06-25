"use client";

/**
 * preferences.ts - Cross-subdomain user-preference sync for *.arda.vxture.com.
 *
 * Locale / theme / density / font-size are written to PARENT-DOMAIN cookies
 * (.arda.vxture.com) so they travel across every Arda app under that apex. Each
 * app, on boot, seeds its DS / provider localStorage from those cookies (see
 * `preferenceBootstrapScript`, injected in every <head>), and same-origin tabs
 * stay live via the storage event + a same-document custom event.
 *
 * Cookie keys are the canonical platform keys from @vxture/shared
 * (NEXT_LOCALE / vx-theme / vx-density); font-size has no platform key yet, so
 * it uses "vx-fontsize". Other apps adopt the same contract to participate.
 */

import { useEffect, useRef } from "react";
import {
  LOCALE_CONSTANTS,
  PREFERENCE_CONSTANTS,
  THEME_CONSTANTS,
} from "@vxture/shared";
import { isArdaLocale, type ArdaLocale } from "./locales";

export type PrefTheme = "system" | "light" | "dark";
export type PrefDensity = "compact" | "default" | "comfortable";
export type PrefFontSize = "small" | "default" | "large";

const FONT_SIZE_LS_KEY = "vx-fontsize";

/** The Arda apex. Subdomain apps (e.g. app.arda.vxture.com) share preference
 *  cookies scoped to this parent so a choice on one travels to the others. */
const ARDA_APEX = "arda.vxture.com";

/** Cookie name per preference (parent-domain, cross-subdomain). */
const COOKIE = {
  locale: LOCALE_CONSTANTS.COOKIE_KEY, // "NEXT_LOCALE"
  theme: THEME_CONSTANTS.COOKIE_KEY, // "vx-theme"
  density: PREFERENCE_CONSTANTS.DENSITY_COOKIE_KEY, // "vx-density"
  fontSize: FONT_SIZE_LS_KEY, // "vx-fontsize"
} as const;

/** localStorage keys the DS / providers already read, so cookie mirrors land
 *  exactly where each consumer looks for its value. */
const LS = {
  locale: LOCALE_CONSTANTS.STORAGE_KEY, // "locale-storage"
  theme: THEME_CONSTANTS.STORAGE_KEY, // "theme-storage"
  density: PREFERENCE_CONSTANTS.DENSITY_STORAGE_KEY, // "vx-density"
  fontSize: FONT_SIZE_LS_KEY, // "vx-fontsize"
} as const;

export const FONT_SIZE_PX: Record<PrefFontSize, string> = {
  small: "15px",
  default: "16px",
  large: "18px",
};

const isTheme = (v: unknown): v is PrefTheme =>
  v === "system" || v === "light" || v === "dark";
const isDensity = (v: unknown): v is PrefDensity =>
  v === "compact" || v === "default" || v === "comfortable";
const isFontSize = (v: unknown): v is PrefFontSize =>
  v === "small" || v === "default" || v === "large";
const isLocale = isArdaLocale;

/** Parent domain so the cookie is shared by every Arda subdomain app. Arda's
 *  apps live under the 3-label apex `arda.vxture.com`, so the cookie is scoped
 *  to `.arda.vxture.com` (not the registrable `.vxture.com`, which would leak
 *  Arda preferences to sibling Vxture products). Returns undefined on localhost
 *  / bare IPs (host-only cookie) and for hosts outside the Arda apex. */
function parentDomain(): string | undefined {
  if (typeof location === "undefined") return undefined;
  const host = location.hostname;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^\d+(\.\d+){3}$/.test(host)
  ) {
    return undefined;
  }
  if (host === ARDA_APEX || host.endsWith(`.${ARDA_APEX}`)) {
    return `.${ARDA_APEX}`;
  }
  // Fallback: the registrable last-two labels for any other host.
  const parts = host.split(".");
  if (parts.length <= 2) return `.${host}`;
  return `.${parts.slice(-2).join(".")}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${escaped}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const domain = parentDomain();
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const domainPart = domain ? `; Domain=${domain}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${PREFERENCE_CONSTANTS.COOKIE_MAX_AGE}; SameSite=Lax${domainPart}${secure}`;
}

function setLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable (privacy mode); cookie still carries it */
  }
}

/** Notify OTHER same-origin tabs of a preference change by bumping the shared
 *  snapshot key; the `storage` event fires only in other documents, never the
 *  one that wrote it. We deliberately do NOT emit a same-document event: within
 *  one tab the React provider/context already propagates the change to every
 *  consumer, and echoing it back re-rendered open popovers mid-click. */
function broadcast(partial: Record<string, string>): void {
  try {
    localStorage.setItem(
      PREFERENCE_CONSTANTS.SYNC_STORAGE_KEY,
      JSON.stringify({ ...partial, ts: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

// -- Apply (DOM) -------------------------------------------------------------

export function applyFontSize(size: PrefFontSize): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = FONT_SIZE_PX[size];
}

// -- Persist (write cookie + mirror localStorage + broadcast) ----------------
// Theme and density are owned by the DS ThemeProvider, which applies the DOM
// change itself; these only persist + broadcast. Locale is mirrored for the
// providers; font-size has no owner, so it is applied here too.

export function persistLocale(locale: ArdaLocale): void {
  writeCookie(COOKIE.locale, locale);
  setLocalStorage(LS.locale, locale);
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
  broadcast({ locale });
}

export function persistTheme(theme: PrefTheme): void {
  writeCookie(COOKIE.theme, theme);
  setLocalStorage(LS.theme, theme);
  broadcast({ theme });
}

export function persistDensity(density: PrefDensity): void {
  writeCookie(COOKIE.density, density);
  setLocalStorage(LS.density, density);
  broadcast({ density });
}

export function persistFontSize(size: PrefFontSize): void {
  writeCookie(COOKIE.fontSize, size);
  setLocalStorage(LS.fontSize, size);
  applyFontSize(size);
  broadcast({ fontSize: size });
}

/** Current font-size preference (cookie first, then localStorage). */
export function getFontSize(): PrefFontSize {
  const fromCookie = readCookie(COOKIE.fontSize);
  if (isFontSize(fromCookie)) return fromCookie;
  if (typeof localStorage !== "undefined") {
    const fromLs = localStorage.getItem(LS.fontSize);
    if (isFontSize(fromLs)) return fromLs;
  }
  return "default";
}

/** Inline <head> script: cookie-first bootstrap that seeds each origin's
 *  localStorage and applies theme/density/font-size before first paint, so a
 *  preference set on one subdomain lands correctly on the next without FOUC.
 *  Supersedes the DS themeBootstrapScript (it also covers density + font-size +
 *  locale). Kept dependency-free and defensive for the pre-hydration context. */
export const preferenceBootstrapScript = `(function(){try{
var ck=function(n){var m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;};
var ls=function(k,v){try{if(v!=null)localStorage.setItem(k,v);}catch(e){}};
var de=document.documentElement;
var theme=ck('${COOKIE.theme}')||localStorage.getItem('${LS.theme}')||'${THEME_CONSTANTS.DEFAULT_THEME}';
ls('${LS.theme}',theme);
var dark=theme==='dark'||(theme==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
de.classList.toggle('dark',dark);
de.style.colorScheme=dark?'dark':'light';
var d=ck('${COOKIE.density}')||localStorage.getItem('${LS.density}');
if(d){ls('${LS.density}',d);['compact','default','comfortable'].forEach(function(x){de.classList.remove('density-'+x);});de.classList.add('density-'+d);}
var fp={small:'15px',default:'16px',large:'18px'};
var f=ck('${COOKIE.fontSize}')||localStorage.getItem('${LS.fontSize}');
if(f&&fp[f]){ls('${LS.fontSize}',f);de.style.fontSize=fp[f];}
var loc=ck('${COOKIE.locale}');
if(loc){ls('${LS.locale}',loc);de.lang=loc;}
}catch(e){}})();`;

export interface PreferenceSetters {
  setLocale?: ((locale: ArdaLocale) => void) | undefined;
  setMode?: ((mode: PrefTheme) => void) | undefined;
  setDensity?: ((density: PrefDensity) => void) | undefined;
}

/**
 * Keeps this tab's React preference state in sync with the cross-subdomain
 * cookies: reconciles once on mount (adopting a value set on another
 * subdomain), then live-updates on the storage event (other same-origin tabs)
 * and the same-document custom event. Pass the app's own provider setters.
 */
export function usePreferenceLiveSync(setters: PreferenceSetters): void {
  const ref = useRef(setters);
  ref.current = setters;
  // Snapshot of the values we last pushed into React state. Calling the locale
  // provider's setLocale re-persists + re-broadcasts, which fires our own
  // listener again; without this guard apply() would recurse forever. We only
  // act when a cookie value actually differs from what we last applied.
  const last = useRef<{
    locale?: string;
    theme?: string;
    density?: string;
    fontSize?: string;
  }>({});

  useEffect(() => {
    const apply = () => {
      const { setLocale, setMode, setDensity } = ref.current;
      const loc = readCookie(COOKIE.locale) ?? undefined;
      const theme = readCookie(COOKIE.theme) ?? undefined;
      const density = readCookie(COOKIE.density) ?? undefined;
      const fontSize = getFontSize();

      if (
        last.current.locale === loc &&
        last.current.theme === theme &&
        last.current.density === density &&
        last.current.fontSize === fontSize
      ) {
        return;
      }
      last.current = { locale: loc, theme, density, fontSize };

      if (setLocale && isLocale(loc)) setLocale(loc);
      if (setMode && isTheme(theme)) setMode(theme);
      if (setDensity && isDensity(density)) setDensity(density);
      applyFontSize(fontSize);
    };

    apply();

    // Cross-tab only: the `storage` event fires in OTHER same-origin documents
    // when any of our keys change. The tab that made the change does not receive
    // it (re-applying mid-interaction dismisses open popovers), so there is
    // intentionally no same-document listener here.
    const watched = new Set<string>([
      PREFERENCE_CONSTANTS.SYNC_STORAGE_KEY,
      LS.locale,
      LS.theme,
      LS.density,
      LS.fontSize,
    ]);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || watched.has(e.key)) apply();
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);
}
