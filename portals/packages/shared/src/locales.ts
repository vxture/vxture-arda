import type { Locale } from "@vxture/shared";
import type { LocaleSelectOption } from "@vxture/design-system";

/**
 * Arda's locale set. The product's primary users are Chinese, so the default
 * locale is zh-CN. `@vxture/shared`'s `Locale` is exactly en-US / zh-CN, so
 * `ArdaLocale` is just an alias here (no app-local extra locales).
 */
export type ArdaLocale = Locale;

export const ARDA_LOCALES: readonly ArdaLocale[] = ["en-US", "zh-CN"];

export const ARDA_DEFAULT_LOCALE: ArdaLocale = "zh-CN";

/** Native display name per locale, for the switcher + preference panel. This
 *  file is exempt from the ASCII scan (it is localized content - locale display
 *  names). */
export const ARDA_LOCALE_NATIVE: Record<ArdaLocale, string> = {
  "en-US": "English",
  "zh-CN": "简体中文",
};

export const isArdaLocale = (v: unknown): v is ArdaLocale =>
  typeof v === "string" && (ARDA_LOCALES as readonly string[]).includes(v);

/** Ready-made options for ShellLocaleSwitcher / ShellPreferencePanel. */
export const ARDA_LOCALE_OPTIONS: LocaleSelectOption[] = ARDA_LOCALES.map(
  (loc) => ({ locale: loc, nativeName: ARDA_LOCALE_NATIVE[loc] }),
);
