/**
 * Quality presentation metadata. The rule rows now come from the DB (see
 * data.ts). The score-trend series and the six quality dimensions remain static
 * presentation aggregates until a metrics/timeseries source exists.
 */
export { LEVEL_TONE, qualityTone, type AssetLevel } from "../dashboard/seed";
export { QUALITY_DIMS } from "../dashboard/seed";

/** Quality score trend over the last audit cycles (presentation aggregate). */
export const SCORE_TREND = [88.1, 89.4, 90.2, 89.8, 91.1, 91.6, 92.0, 91.4, 92.2, 92.4];

export function passColor(pass: number): string {
  if (pass >= 95) return "var(--vx-color-success-500)";
  if (pass >= 90) return "var(--vx-color-info-500)";
  return "var(--vx-color-warning-500)";
}
