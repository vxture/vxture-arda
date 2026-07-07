/**
 * Workspace quota types for arda.
 *
 * Sourced from GET /platform/entitlements (C2) response:
 *   capabilities -> CapabilityLimits  (tier caps, checked before create/publish)
 *   quota_pools  -> QuotaPool entries (consumable monthly budgets, reported via C3)
 *
 * Metric names below are the canonical strings both arda and vxture platform
 * must agree on. See docs/20-design/arda-biz-billing.md for the full spec.
 */

// ---- C3 metric name constants ------------------------------------------------
// Use these everywhere instead of bare strings to avoid typos.

export const METRICS = {
  /**
   * Workspace shared storage pool (bytes). GAUGE (snapshot), not a counter -
   * reported via the future PUT /usage/gauge, NOT POST /usage/consume
   * (reply-01 R4: delta rejected). Until the gauge endpoint ships, storage is
   * C2-display + local admission only and is NOT wired into recordUsage.
   * L0 platform_metric (product_220 §4): shared physical pool, summed across products.
   */
  STORAGE_BYTES: "storage.bytes",
  /** External DataService call. counter, divisible 后报 (reply-01 R5). amount=1. */
  SERVICE_API_CALL: "service.api.call",
  /** QualityRule batch execution. counter, divisible 后报 (reply-01 R5). amount=rules_run. */
  QUALITY_CHECK_RUN: "quality.check.run",
  /**
   * AI credit. counter, ATOMIC pre-deduct (reply-01 R5). amount=credits_spent.
   * L0 platform_metric, renamed from varda.credit (product_220 §4/§9). Pools are
   * earmarked per contributing product by default; tenant admin may opt into a
   * shared overflow pool (reply-02 §2). 1 credit ~= 2K tokens.
   */
  AI_CREDIT: "ai.credit",
} as const;

export type MetricName = (typeof METRICS)[keyof typeof METRICS];

// ---- Capability limits (from C2 capabilities map) ----------------------------

export interface CapabilityLimits {
  /** Max human members in workspace. Null = unlimited (enterprise). */
  memberMax: number | null;
  /** Max registered Datasets. Null = unlimited. */
  datasetMax: number | null;
  /** Max connected DataSources. Null = unlimited. */
  datasourceMax: number | null;
  /** Max published DataService endpoints. 0 = not available on this tier. */
  serviceEndpointMax: number | null;
  /** varda agent access enabled on this tier. */
  vardaEnabled: boolean;
  /** varda is restricted to read-only DataService calls (pro tier). */
  vardaReadonly: boolean;
  /** Sync frequency allowed: manual | daily | hourly | realtime */
  syncFrequency: "manual" | "daily" | "hourly" | "realtime";
  /** Data retention days. Null = unlimited (enterprise). */
  retentionDays: number | null;
}

// ---- Quota pool (from C2 quota_pools array) ----------------------------------

export interface QuotaPool {
  metric: MetricName;
  /** Monthly limit (or bytes cap for storage). */
  limit: number;
  /** Remaining within current period (platform is source of truth). */
  remaining: number;
  /** Fraction remaining: remaining / limit. Convenience for UI thresholds. */
  pct: number;
}

// ---- WorkspaceQuota: full picture for one workspace -------------------------

export interface WorkspaceQuota {
  capabilities: CapabilityLimits;
  /** Orthogonal source flag (product_220 §3): an agent Plan bundles arda's data
   *  base capability. Enables data access without a standalone subscription. */
  bundled: boolean;
  pools: {
    storageBytes: QuotaPool | null;
    apiCall: QuotaPool | null;
    qualityCheckRun: QuotaPool | null;
    /** AI credit remaining = this product's ELIGIBLE pools (earmarked + shared
     *  the product participates in), not a single global wallet (reply-02 §2). */
    aiCredit: QuotaPool | null;
  };
}

// ---- Defaults (used by MockResolver and as safe fallback) -------------------

export const FREE_CAPABILITY_LIMITS: CapabilityLimits = {
  memberMax: 1,
  datasetMax: 50,
  datasourceMax: 2,
  serviceEndpointMax: 0,
  vardaEnabled: false,
  vardaReadonly: false,
  syncFrequency: "manual",
  retentionDays: 30,
};

export const FREE_QUOTA_POOLS: WorkspaceQuota["pools"] = {
  storageBytes: {
    metric: METRICS.STORAGE_BYTES,
    limit: 1_073_741_824, // 1 GB
    remaining: 1_073_741_824,
    pct: 1,
  },
  apiCall: {
    metric: METRICS.SERVICE_API_CALL,
    limit: 1_000,
    remaining: 1_000,
    pct: 1,
  },
  qualityCheckRun: {
    metric: METRICS.QUALITY_CHECK_RUN,
    limit: 100,
    remaining: 100,
    pct: 1,
  },
  aiCredit: null, // not available on free
};

// ---- Parser: map raw platform response to WorkspaceQuota --------------------

function parsePool(
  pools: Array<{ metric: string; limit: number; remaining: number }>,
  metric: MetricName,
): QuotaPool | null {
  const raw = pools.find((p) => p.metric === metric);
  if (!raw) return null;
  return {
    metric,
    limit: raw.limit,
    remaining: raw.remaining,
    pct: raw.limit > 0 ? raw.remaining / raw.limit : 0,
  };
}

export function mapToWorkspaceQuota(
  capabilities: Record<string, unknown>,
  quota_pools: Array<{ metric: string; limit: number; remaining: number; priority: number }>,
): WorkspaceQuota {
  const num = (key: string, fallback: number | null): number | null => {
    const v = capabilities[key];
    if (v === null || v === undefined) return fallback;
    if (v === -1 || v === "unlimited") return null;
    return typeof v === "number" ? v : fallback;
  };

  const caps: CapabilityLimits = {
    memberMax: num("member.max", 1),
    datasetMax: num("dataset.max", 50),
    datasourceMax: num("datasource.max", 2),
    serviceEndpointMax: num("service_endpoint.max", 0),
    vardaEnabled: Boolean(capabilities["varda.enabled"]),
    vardaReadonly: Boolean(capabilities["varda.readonly"]),
    syncFrequency:
      (capabilities["sync.frequency"] as CapabilityLimits["syncFrequency"]) ?? "manual",
    retentionDays: num("retention.days", 30),
  };

  return {
    capabilities: caps,
    bundled: capabilities["bundled"] === true,
    pools: {
      storageBytes: parsePool(quota_pools, METRICS.STORAGE_BYTES),
      apiCall: parsePool(quota_pools, METRICS.SERVICE_API_CALL),
      qualityCheckRun: parsePool(quota_pools, METRICS.QUALITY_CHECK_RUN),
      aiCredit: parsePool(quota_pools, METRICS.AI_CREDIT),
    },
  };
}
