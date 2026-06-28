/**
 * Static seed data for the dashboard (Phase 1 - no DB yet). Generic intelligent
 * data-platform sample content; swap for real APIs once the domain schema and
 * entitlement sync land. Colors are DS tokens only.
 */
import type { StatusBadgeTone } from "@vxture/design-system";
import type { PIconName } from "../../ui/phosphor-icon";

export type AssetLevel = "public" | "internal" | "sensitive" | "core";

export const LEVEL_TONE: Record<AssetLevel, StatusBadgeTone> = {
  public: "success",
  internal: "info",
  sensitive: "warning",
  core: "danger",
};

export function qualityTone(score: number): StatusBadgeTone {
  if (score >= 95) return "success";
  if (score >= 85) return "info";
  if (score >= 70) return "warning";
  return "danger";
}

export interface DomainMeta {
  icon: PIconName;
  color: string;
}

export const DOMAINS: Record<string, DomainMeta> = {
  customer: { icon: "users-three", color: "var(--vx-color-brand-600)" },
  product: { icon: "stack", color: "var(--vx-color-info-600)" },
  marketing: { icon: "broadcast", color: "var(--vx-color-teal-600)" },
  finance: { icon: "buildings", color: "var(--vx-color-success-600)" },
  operations: { icon: "flow-arrow", color: "var(--vx-color-warning-500)" },
  web: { icon: "chart-line-up", color: "var(--vx-color-danger-600)" },
};

export const GROWTH_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
export const ASSET_GROWTH = [9840, 10380, 10920, 11560, 12180, 12847].map((v) => ({ v }));

export const TEAM_BARS = [
  { label: "Platform", value: 3284, color: "var(--vx-color-brand-600)" },
  { label: "Analytics", value: 2956, color: "var(--vx-color-info-600)" },
  { label: "Engineering", value: 2410, color: "var(--vx-color-teal-600)" },
  { label: "Growth", value: 1880, color: "var(--vx-color-success-600)" },
  { label: "Finance", value: 1240, color: "var(--vx-color-warning-500)" },
  { label: "Ops", value: 980, color: "var(--vx-color-gray-600)" },
];

/** Domain distribution; label keys resolve via i18n "dashboard.domain.<key>". */
export const DOMAIN_DONUT = [
  { key: "customer", value: 2010, color: "var(--vx-color-brand-600)" },
  { key: "web", value: 1840, color: "var(--vx-color-danger-600)" },
  { key: "product", value: 1560, color: "var(--vx-color-info-600)" },
  { key: "operations", value: 1320, color: "var(--vx-color-warning-500)" },
  { key: "marketing", value: 1120, color: "var(--vx-color-teal-600)" },
  { key: "finance", value: 980, color: "var(--vx-color-success-600)" },
];

/** Quality dimensions; name keys resolve via i18n "dashboard.dim.<key>". */
export const QUALITY_DIMS = [
  { key: "completeness", score: 95.2 },
  { key: "accuracy", score: 92.8 },
  { key: "consistency", score: 89.4 },
  { key: "timeliness", score: 94.1 },
  { key: "uniqueness", score: 96.7 },
  { key: "validity", score: 90.3 },
];

export interface TopAsset {
  id: string;
  name: string;
  code: string;
  domain: keyof typeof DOMAINS;
  level: AssetLevel;
  quality: number;
  subs: number;
}

export const TOP_ASSETS: TopAsset[] = [
  { id: "T-1042", name: "Customer Master", code: "dw_customer_master", domain: "customer", level: "core", quality: 96.4, subs: 142 },
  { id: "T-2087", name: "Order Transactions", code: "dw_order_txn", domain: "product", level: "internal", quality: 93.1, subs: 98 },
  { id: "T-3310", name: "Web Clickstream", code: "dw_web_clickstream", domain: "web", level: "public", quality: 98.2, subs: 76 },
  { id: "T-1180", name: "Revenue Ledger", code: "dw_revenue_ledger", domain: "finance", level: "sensitive", quality: 91.7, subs: 64 },
  { id: "T-7714", name: "Product Catalog", code: "dw_product_catalog", domain: "product", level: "public", quality: 94.8, subs: 87 },
];

export interface DashAlert {
  key: string;
  icon: PIconName;
  tone: string;
  route: string;
}

export const ALERTS: DashAlert[] = [
  { key: "a1", icon: "warning-octagon", tone: "var(--vx-color-danger-600)", route: "/etl" },
  { key: "a2", icon: "warning", tone: "var(--vx-color-warning-500)", route: "/quality" },
  { key: "a3", icon: "lock-key-open", tone: "var(--vx-color-warning-500)", route: "/security" },
  { key: "a4", icon: "git-pull-request", tone: "var(--vx-color-info-600)", route: "/standards" },
];
