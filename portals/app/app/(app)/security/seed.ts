/**
 * Static seed for Data Security (no DB yet). Classification distribution and
 * sharing-authorization requests for a generic intelligent data platform.
 */
import type { StatusBadgeTone } from "@vxture/design-system";
import type { AssetLevel } from "../dashboard/seed";

export { LEVEL_TONE, type AssetLevel } from "../dashboard/seed";

/** Classification distribution; key matches the level i18n keys. */
export const DIST: { key: AssetLevel; value: number; color: string }[] = [
  { key: "public", value: 4820, color: "var(--vx-color-success-600)" },
  { key: "internal", value: 5240, color: "var(--vx-color-info-600)" },
  { key: "sensitive", value: 2180, color: "var(--vx-color-warning-500)" },
  { key: "core", value: 607, color: "var(--vx-color-danger-600)" },
];

export const REQUEST_TONE: Record<string, StatusBadgeTone> = {
  pending: "warning",
  approved: "success",
};

export interface ShareRequest {
  who: string;
  asset: string;
  level: AssetLevel;
  time: string;
  status: string; // pending | approved
}

export const REQUESTS: ShareRequest[] = [
  { who: "Risk & Compliance", asset: "Customer Master", level: "core", time: "8 min ago", status: "pending" },
  { who: "Operations Center", asset: "Revenue Ledger", level: "sensitive", time: "1 hr ago", status: "pending" },
  { who: "Finance BI", asset: "Subscription Entitlements", level: "core", time: "2 hr ago", status: "approved" },
  { who: "Open Data Portal", asset: "Product Catalog", level: "public", time: "today", status: "approved" },
];
