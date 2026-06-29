/**
 * Static seed data for the asset catalog (Phase 2 - no DB-backed catalog yet).
 * Generic intelligent data-platform sample assets. Reuses the shared asset-meta
 * helpers from the dashboard seed. Swap for the Prisma-backed catalog once the
 * read path is wired. Colors are DS tokens only.
 */
import type { AssetLevel } from "../dashboard/seed";

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

export interface CatalogAsset {
  id: string;
  name: string;
  code: string;
  domain: string; // key of DOMAINS
  dept: string; // key of DEPARTMENTS
  level: AssetLevel;
  quality: number;
  rows: string;
  fields: number;
  freq: string; // i18n key: realtime | daily | weekly | monthly
  updated: string;
  subs: number;
  owner: string;
  desc: string;
}

export const ASSETS: CatalogAsset[] = [
  { id: "T-1042", name: "Customer Master", code: "dw_customer_master", domain: "customer", dept: "platform", level: "core", quality: 96.4, rows: "12.1M", fields: 38, freq: "realtime", updated: "5 min ago", subs: 142, owner: "A. Rivera", desc: "Authoritative master record for every customer: identity, contacts, and lifecycle attributes. The core reference dataset of the customer domain." },
  { id: "T-2087", name: "Order Transactions", code: "dw_order_txn", domain: "product", dept: "engineering", level: "internal", quality: 93.1, rows: "384M", fields: 52, freq: "daily", updated: "1 hr ago", subs: 98, owner: "L. Chen", desc: "Line-item order and transaction history across all channels, used for revenue, retention, and product analytics." },
  { id: "T-3310", name: "Web Clickstream", code: "dw_web_clickstream", domain: "web", dept: "growth", level: "public", quality: 98.2, rows: "1.2B", fields: 24, freq: "realtime", updated: "streaming", subs: 76, owner: "M. Okafor", desc: "Page views, sessions, and events from web and app surfaces, feeding funnel and attribution models." },
  { id: "T-1180", name: "Revenue Ledger", code: "dw_revenue_ledger", domain: "finance", dept: "finance", level: "sensitive", quality: 91.7, rows: "27.4M", fields: 31, freq: "daily", updated: "12 min ago", subs: 64, owner: "S. Patel", desc: "Recognized revenue and billing events reconciled to the general ledger, with strict access controls." },
  { id: "T-4521", name: "Marketing Attribution", code: "dw_mkt_attribution", domain: "marketing", dept: "growth", level: "internal", quality: 88.5, rows: "9.1M", fields: 46, freq: "daily", updated: "2 hr ago", subs: 53, owner: "R. Haddad", desc: "Multi-touch attribution joining campaign spend to conversions across paid and organic channels." },
  { id: "T-5093", name: "Support Tickets", code: "dw_support_tickets", domain: "customer", dept: "ops", level: "sensitive", quality: 84.2, rows: "18.6M", fields: 18, freq: "realtime", updated: "streaming", subs: 41, owner: "J. Park", desc: "Customer support cases, interactions, and resolution metrics, used for CSAT and churn-risk signals." },
  { id: "T-6320", name: "Inventory Telemetry", code: "dw_inventory_iot", domain: "operations", dept: "ops", level: "internal", quality: 79.6, rows: "640M", fields: 22, freq: "realtime", updated: "streaming", subs: 28, owner: "T. Mori", desc: "Warehouse and fulfilment sensor telemetry powering stock-out prediction and operations dashboards." },
  { id: "T-7714", name: "Product Catalog", code: "dw_product_catalog", domain: "product", dept: "engineering", level: "public", quality: 94.8, rows: "182K", fields: 29, freq: "weekly", updated: "today 09:42", subs: 87, owner: "C. Silva", desc: "Canonical product, SKU, and pricing reference shared across storefront, analytics, and search." },
  { id: "T-8210", name: "Subscription Entitlements", code: "dw_subscriptions", domain: "finance", dept: "platform", level: "core", quality: 90.3, rows: "4.6M", fields: 41, freq: "daily", updated: "3 hr ago", subs: 19, owner: "H. Yusuf", desc: "Per-workspace subscription state and tier history mirrored from the platform, governed and audited." },
  { id: "T-9056", name: "Campaign Performance", code: "dw_campaign_perf", domain: "marketing", dept: "analytics", level: "internal", quality: 95.1, rows: "52.8M", fields: 57, freq: "daily", updated: "yesterday 23:10", subs: 62, owner: "R. Haddad", desc: "Aggregated campaign delivery, engagement, and ROI metrics by channel, segment, and geography." },
  { id: "T-1267", name: "Churn Risk Scores", code: "dw_churn_scores", domain: "customer", dept: "analytics", level: "sensitive", quality: 87.9, rows: "12.0M", fields: 33, freq: "weekly", updated: "1 day ago", subs: 35, owner: "L. Chen", desc: "Model-scored churn propensity per customer with feature contributions, used by growth and success teams." },
  { id: "T-1389", name: "Clickstream Sessions", code: "dw_web_sessions", domain: "web", dept: "growth", level: "public", quality: 82.4, rows: "340M", fields: 27, freq: "weekly", updated: "today 06:00", subs: 44, owner: "M. Okafor", desc: "Sessionised clickstream rollups with device, geo, and acquisition attributes for cohort analysis." },
];

export function getAsset(id: string): CatalogAsset | undefined {
  return ASSETS.find((a) => a.id === id);
}
