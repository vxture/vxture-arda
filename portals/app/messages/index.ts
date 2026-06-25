import type { ArdaLocale } from "@arda/shared/locales";
import type { Messages } from "@arda/shared/i18n";
import enUS from "./en-US.json";
import zhCN from "./zh-CN.json";

/** Arda translation bundles, one per locale. Add a locale = add a JSON file
 *  here. Passed to <I18nProvider> in app/layout.tsx. */
export const messages: Record<ArdaLocale, Messages> = {
  "en-US": enUS,
  "zh-CN": zhCN,
};
