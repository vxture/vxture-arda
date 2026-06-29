/**
 * Catalog presentation metadata (domains, teams, level/quality tone helpers).
 * The catalog rows themselves now come from the DB (see data.ts); this file only
 * holds the static display meta shared by the client components.
 */
export { LEVEL_TONE, qualityTone, DOMAINS, type AssetLevel } from "../dashboard/seed";

/** Owning team; name resolves via i18n "catalog.dept.<key>". */
export const DEPARTMENTS: Record<string, { color: string }> = {
  platform: { color: "var(--vx-color-brand-600)" },
  analytics: { color: "var(--vx-color-info-600)" },
  engineering: { color: "var(--vx-color-teal-600)" },
  growth: { color: "var(--vx-color-success-600)" },
  finance: { color: "var(--vx-color-warning-500)" },
  ops: { color: "var(--vx-color-gray-600)" },
};
