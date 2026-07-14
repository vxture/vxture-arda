/**
 * Product capability matrix for arda (ent-110 §2a, owner ruling 2026-07-13).
 *
 * Which tier unlocks which feature is PRODUCT knowledge, versioned in this
 * repo. The platform delivers only commercial facts (status/tier/bundled +
 * limits/quota_pools, ent-120 v2) and never configures or delivers feature
 * keys - the former C2 `capabilities.features` field is ignored.
 *
 * Evaluation is a local pure function: no network call, valid against a
 * cached envelope even when the platform is unreachable (loose coupling).
 *
 * Editing rules:
 *  - Key catalog lives in docs/20-design/domain-entities-and-feature-keys.md
 *    §3.1; add keys there first, then here.
 *  - Tiers are cumulative BY CONSTRUCTION (each tier spreads the previous
 *    one). Never remove a key from a higher tier without an owner decision.
 *  - Changing this matrix is a product release (review + version); the
 *    pricing page reads an exported artifact of it (console-side, one-way).
 *  - Quota is NOT here: numeric caps (limits) and consumable pools
 *    (quota_pools) are platform-owned sales strategy (quota.ts).
 */

import { TIER_ORDER, hasProductAccess, type Subscription, type Tier } from "./types";

// ---- Feature key catalog (mirrors feature-keys doc §3.1) ---------------------

export const FEATURE_KEYS = [
  // assets
  "arda.assets.catalog",
  "arda.assets.edit_metadata",
  "arda.assets.glossary",
  "arda.assets.advanced_search",
  "arda.assets.bulk_ops",
  // integration
  "arda.integration.sources_basic",
  "arda.integration.sources_premium",
  "arda.integration.pipelines", // future
  "arda.integration.scheduling", // future
  "arda.integration.realtime", // future
  // governance
  "arda.governance.standards",
  "arda.governance.master_data",
  "arda.governance.policies",
  "arda.governance.classification",
  "arda.governance.lineage",
  "arda.governance.quality_rules",
  // services
  "arda.services.publish_api",
  "arda.services.data_products",
  "arda.services.cross_workspace_share", // data-160 G1
  // admin
  "arda.admin.api_keys",
  "arda.admin.audit_log",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Keys defined but not yet built. Gate returns false for them like any
 *  un-tiered key; UI distinguishes via isFutureFeature() to render a
 *  "coming soon" placeholder instead of an upgrade prompt. */
export const FUTURE_FEATURE_KEYS: ReadonlySet<FeatureKey> = new Set([
  "arda.integration.pipelines",
  "arda.integration.scheduling",
  "arda.integration.realtime",
]);

// ---- The matrix (cumulative by construction) ---------------------------------

const FREE_FEATURES = [
  "arda.assets.catalog",
  "arda.assets.edit_metadata",
  "arda.integration.sources_basic",
] as const satisfies readonly FeatureKey[];

const STARTER_FEATURES = [
  ...FREE_FEATURES,
  "arda.assets.glossary",
  "arda.assets.advanced_search",
  "arda.governance.classification",
  "arda.governance.quality_rules",
] as const satisfies readonly FeatureKey[];

// Tier philosophy (owner ruling 2026-07-14, platform-wide): pro = ALL product
// features except multi-user/collaboration ones; business = pro + seats, where
// the seat difference is a MANAGEMENT difference, not a business-function
// difference. Keeps per-tier feature config simple by design.
const PRO_FEATURES = [
  ...STARTER_FEATURES,
  "arda.assets.bulk_ops",
  "arda.integration.sources_premium",
  "arda.governance.standards",
  "arda.governance.master_data",
  "arda.governance.policies",
  "arda.governance.lineage",
  "arda.services.publish_api",
  "arda.services.data_products",
  "arda.admin.api_keys",
  "arda.admin.audit_log",
] as const satisfies readonly FeatureKey[];

const BUSINESS_FEATURES = [
  ...PRO_FEATURES,
  // The ONLY business-exclusive key: cross-workspace sharing is inherently a
  // multi-workspace/collaboration capability (org plan). Everything else in
  // business is seats + management, expressed via limits, not feature keys.
  "arda.services.cross_workspace_share",
] as const satisfies readonly FeatureKey[];

const ENTERPRISE_FEATURES = [
  ...BUSINESS_FEATURES,
  // enterprise = private-deployment edition: same keys as business by
  // construction; differences live in limits/support/licensing
] as const satisfies readonly FeatureKey[];

export const CAPABILITY_MATRIX: Record<Tier, readonly FeatureKey[]> = {
  free: FREE_FEATURES,
  starter: STARTER_FEATURES,
  pro: PRO_FEATURES,
  business: BUSINESS_FEATURES,
  enterprise: ENTERPRISE_FEATURES,
};

// ---- Evaluation (pure, local) -------------------------------------------------

/** Capability gate: product-UI access (status active/trialing) AND the
 *  workspace's tier includes the key. tier=null (never subscribed, or
 *  bundled-only backend access) never unlocks product-UI features. */
export function canUseFeature(sub: Subscription, key: FeatureKey): boolean {
  if (!hasProductAccess(sub) || sub.tier === null) return false;
  return CAPABILITY_MATRIX[sub.tier].includes(key);
}

/** Whether a key is defined but not yet built ("coming soon" placeholder). */
export function isFutureFeature(key: FeatureKey): boolean {
  return FUTURE_FEATURE_KEYS.has(key);
}

/** Lowest tier that unlocks the key, or null if no tier does (future keys).
 *  This is the upgrade CTA target (console deep-link target_tier param) -
 *  product knowledge, never asked of the platform. */
export function minTierFor(key: FeatureKey): Tier | null {
  for (const tier of TIER_ORDER) {
    if (CAPABILITY_MATRIX[tier].includes(key)) return tier;
  }
  return null;
}

// ---- Tier-derived capability levels (former platform booleans, re-homed) -----
// These left the C2 contract on 2026-07-13 (biz-260 §1): varda access and sync
// frequency are product capability levels keyed by tier, not platform config.

export interface VardaAccess {
  enabled: boolean;
  /** true = restricted to read-only DataService calls (starter/pro). */
  readonly: boolean;
}

/** varda agent access per tier (biz-260 §0: opens at starter read-only,
 *  business and above get read-write). */
export function vardaAccessForTier(tier: Tier | null): VardaAccess {
  if (tier === null || tier === "free") return { enabled: false, readonly: false };
  if (tier === "starter" || tier === "pro") return { enabled: true, readonly: true };
  return { enabled: true, readonly: false };
}

export type SyncFrequency = "manual" | "daily" | "hourly" | "realtime";

/** Highest data-source sync cadence allowed per tier. */
export function syncFrequencyForTier(tier: Tier | null): SyncFrequency {
  switch (tier) {
    case "starter":
      return "daily";
    case "pro":
      return "hourly";
    case "business":
    case "enterprise":
      return "realtime";
    default:
      return "manual";
  }
}
