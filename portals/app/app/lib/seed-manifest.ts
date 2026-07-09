/**
 * Curated default seed manifest: the sample catalog content that a brand-new
 * workspace is filled with on first entry (see seed-fill.ts). This is the single
 * source of truth for that content - both the dev seed (`prisma/seed.ts`) and the
 * runtime template cloner consume these arrays, and `ensureSeedTemplate` persists
 * the manifest into `TemplateVersion.manifest` for provenance.
 *
 * v1 keeps the content in code (not authored per-workspace). When the platform
 * curates its own templates, those become additional SeedTemplate/TemplateVersion
 * rows; this default remains the fallback.
 */
import type { AssetLevel } from "../../generated/prisma/client";

export interface ManifestDataset {
  code: string;
  name: string;
  domain: string;
  team: string;
  level: AssetLevel;
  refreshFreq: string;
  rows: number;
  type: string;
  owner: string;
  description: string;
}

export interface ManifestStandard {
  code: string;
  name: string;
  type: string;
  ref: string;
  items: number;
  usage: number;
  status: string;
}

export interface ManifestQualityRule {
  code: string;
  name: string;
  datasetCode: string;
  type: string;
  dimension: string;
  prevScore: number;
  score: number;
  issues: number;
}

export interface ManifestService {
  code: string;
  name: string;
  path: string;
  method: string;
  domain: string;
  level: AssetLevel;
  type: string;
  status: string;
  description: string;
}

export interface SeedManifest {
  datasets: ManifestDataset[];
  standards: ManifestStandard[];
  qualityRules: ManifestQualityRule[];
  services: ManifestService[];
}

export const DATASETS: ManifestDataset[] = [
  { code: "dw_customer_master", name: "Customer Master", domain: "customer", team: "platform", level: "core", refreshFreq: "realtime", rows: 12_100_000, type: "table", owner: "A. Rivera", description: "Authoritative master record for every customer: identity, contacts, and lifecycle attributes." },
  { code: "dw_order_txn", name: "Order Transactions", domain: "product", team: "engineering", level: "internal", refreshFreq: "daily", rows: 384_000_000, type: "table", owner: "L. Chen", description: "Line-item order and transaction history across all channels." },
  { code: "dw_web_clickstream", name: "Web Clickstream", domain: "web", team: "growth", level: "public", refreshFreq: "realtime", rows: 1_200_000_000, type: "stream", owner: "M. Okafor", description: "Page views, sessions, and events from web and app surfaces." },
  { code: "dw_revenue_ledger", name: "Revenue Ledger", domain: "finance", team: "finance", level: "sensitive", refreshFreq: "daily", rows: 27_400_000, type: "table", owner: "S. Patel", description: "Recognized revenue and billing events reconciled to the general ledger." },
  { code: "dw_mkt_attribution", name: "Marketing Attribution", domain: "marketing", team: "growth", level: "internal", refreshFreq: "daily", rows: 9_100_000, type: "table", owner: "R. Haddad", description: "Multi-touch attribution joining campaign spend to conversions." },
  { code: "dw_support_tickets", name: "Support Tickets", domain: "customer", team: "ops", level: "sensitive", refreshFreq: "realtime", rows: 18_600_000, type: "table", owner: "J. Park", description: "Customer support cases, interactions, and resolution metrics." },
  { code: "dw_inventory_iot", name: "Inventory Telemetry", domain: "operations", team: "ops", level: "internal", refreshFreq: "realtime", rows: 640_000_000, type: "stream", owner: "T. Mori", description: "Warehouse and fulfilment sensor telemetry." },
  { code: "dw_product_catalog", name: "Product Catalog", domain: "product", team: "engineering", level: "public", refreshFreq: "weekly", rows: 182_000, type: "table", owner: "C. Silva", description: "Canonical product, SKU, and pricing reference." },
  { code: "dw_subscriptions", name: "Subscription Entitlements", domain: "finance", team: "platform", level: "core", refreshFreq: "daily", rows: 4_600_000, type: "table", owner: "H. Yusuf", description: "Per-workspace subscription state and tier history mirrored from the platform." },
  { code: "dw_campaign_perf", name: "Campaign Performance", domain: "marketing", team: "analytics", level: "internal", refreshFreq: "daily", rows: 52_800_000, type: "view", owner: "R. Haddad", description: "Aggregated campaign delivery, engagement, and ROI metrics." },
  { code: "dw_churn_scores", name: "Churn Risk Scores", domain: "customer", team: "analytics", level: "sensitive", refreshFreq: "weekly", rows: 12_000_000, type: "table", owner: "L. Chen", description: "Model-scored churn propensity per customer with feature contributions." },
  { code: "dw_web_sessions", name: "Clickstream Sessions", domain: "web", team: "growth", level: "public", refreshFreq: "weekly", rows: 340_000_000, type: "view", owner: "M. Okafor", description: "Sessionised clickstream rollups with device, geo, and acquisition attributes." },
];

export const STANDARDS: ManifestStandard[] = [
  { code: "STD-001", name: "Country Codes", type: "code-set", ref: "ISO 3166-1", items: 249, usage: 1204, status: "published" },
  { code: "STD-002", name: "Currency Codes", type: "code-set", ref: "ISO 4217", items: 180, usage: 968, status: "published" },
  { code: "STD-003", name: "Unified Org Identifier", type: "data-element", ref: "Internal STD-ORG", items: 1, usage: 842, status: "published" },
  { code: "STD-004", name: "Postal Address Structure", type: "data-element", ref: "Internal STD-ADDR", items: 9, usage: 624, status: "published" },
  { code: "STD-005", name: "Product Category Taxonomy", type: "code-set", ref: "Internal 2026", items: 142, usage: 88, status: "draft" },
  { code: "STD-006", name: "Data Classification Levels", type: "code-set", ref: "Internal SEC", items: 64, usage: 53, status: "review" },
  { code: "STD-007", name: "Date / Time Format", type: "data-element", ref: "ISO 8601", items: 1, usage: 1486, status: "published" },
  { code: "STD-008", name: "Language Codes", type: "code-set", ref: "ISO 639-1", items: 184, usage: 312, status: "published" },
];

export const QUALITY_RULES: ManifestQualityRule[] = [
  { code: "Q-201", name: "Identifier checksum", datasetCode: "dw_customer_master", type: "not_null", dimension: "validity", prevScore: 99.4, score: 99.2, issues: 9842 },
  { code: "Q-188", name: "Order id uniqueness", datasetCode: "dw_order_txn", type: "unique", dimension: "uniqueness", prevScore: 97.2, score: 97.6, issues: 12480 },
  { code: "Q-174", name: "Geo bounds check", datasetCode: "dw_web_clickstream", type: "range", dimension: "accuracy", prevScore: 99.8, score: 99.8, issues: 1204 },
  { code: "Q-159", name: "Timestamp null rate", datasetCode: "dw_support_tickets", type: "not_null", dimension: "completeness", prevScore: 92.0, score: 91.4, issues: 184200 },
  { code: "Q-143", name: "Amount range threshold", datasetCode: "dw_revenue_ledger", type: "range", dimension: "validity", prevScore: 85.0, score: 86.2, issues: 42600 },
  { code: "Q-126", name: "Freshness SLA", datasetCode: "dw_churn_scores", type: "freshness", dimension: "timeliness", prevScore: 89.5, score: 88.7, issues: 23400 },
];

export const SERVICES: ManifestService[] = [
  { code: "API-1042", name: "Customer Verify", path: "/api/v2/customer/verify", method: "POST", domain: "customer", level: "core", type: "rest_api", status: "running", description: "Verify a customer by identifier and return a masked profile summary." },
  { code: "API-2087", name: "Org Lookup", path: "/api/v2/org/entity", method: "GET", domain: "finance", level: "internal", type: "rest_api", status: "running", description: "Look up an organization's registration and status by unified identifier." },
  { code: "API-3310", name: "Geocode", path: "/api/v2/geo/geocode", method: "GET", domain: "operations", level: "public", type: "rest_api", status: "running", description: "Forward and reverse geocoding against the standard address library." },
  { code: "API-4521", name: "Risk Score", path: "/api/v2/risk/score", method: "POST", domain: "customer", level: "core", type: "rest_api", status: "review", description: "Return a customer risk score; requires approval before invocation." },
  { code: "API-5093", name: "Realtime Heatmap", path: "/api/v2/web/heatmap", method: "GET", domain: "web", level: "sensitive", type: "query", status: "running", description: "Aggregated realtime activity heatmap, refreshed every 5 minutes." },
  { code: "API-6320", name: "Inventory Report", path: "/api/v2/ops/report", method: "POST", domain: "operations", level: "internal", type: "rest_api", status: "paused", description: "Submit and retrieve inventory reconciliation reports." },
];

export const DEFAULT_MANIFEST: SeedManifest = {
  datasets: DATASETS,
  standards: STANDARDS,
  qualityRules: QUALITY_RULES,
  services: SERVICES,
};

// Stable identity of the default template row (used for upsert + audit target).
export const DEFAULT_TEMPLATE_ID = "seed-tmpl-default";
export const DEFAULT_TEMPLATE_NAME = "default";
export const DEFAULT_TEMPLATE_VERSION = "v1";
