/**
 * Client for the vxture platform C2 entitlement endpoint.
 * GET /platform/entitlements?workspace_id={W}&product=arda
 * Auth: product-owned, verified workspace-bound Bearer ticket.
 *
 * Response contract: ent-120 v2 (commercial facts + limits + quota_pools).
 * Transition (reply-06 §1): tolerates the v1 envelope - top-level fields fall
 * back to the legacy `capabilities` map for tier/bundled/numeric caps, and a
 * still-delivered `capabilities.features` is ignored entirely (capability
 * semantics are product-owned, capability.ts). No lockstep deploy needed.
 *
 * Cache: caller is responsible for short-TTL caching (see PlatformEntitlementResolver).
 */

import type { Subscription, SubscriptionStatus } from "./types";
import type { Tier } from "./types";
import { TIER_ORDER } from "./types";
import { SUBSCRIPTION_STATUSES } from "@vxture/shared";
import type { WorkspaceQuota } from "./quota";
import { mapToWorkspaceQuota } from "./quota";
import { platformRequest, workspacePlatformContext } from "../platform/client";
import type { PlatformContext } from "../platform/ticket";

interface EntitlementsResponse {
  workspace_id: string;
  product: string;
  /** v2 field name (arda_200 v2.0 2.2: renamed from subscription_status). */
  status?: string | null;
  // v1 legacy name, kept as fallback. null/absent = never subscribed.
  subscription_status?: string | null;
  // v2 top-level commercial facts (fall back to `capabilities` while v1 ships).
  tier?: string | null;
  bundled?: boolean;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  data_retention_until?: string | null;
  /** v2: numeric sales caps (member.max, dataset.max, ...). */
  limits?: Record<string, unknown> | null;
  /** v1 legacy map; ignored except as numeric-cap/tier/bundled fallback. */
  capabilities?: Record<string, unknown> | null;
  quota_pools?: Array<{ metric: string; limit: number; remaining: number; priority: number }> | null;
}

export interface PlatformEntitlementResult {
  subscription: Subscription;
  quota: WorkspaceQuota;
}

/** Pure envelope parser (exported for verification): v2-first, v1-tolerant. */
export function parseEntitlementEnvelope(body: EntitlementsResponse): PlatformEntitlementResult {
  return {
    subscription: mapToSubscription(body),
    quota: mapToWorkspaceQuota({
      limits: body.limits,
      capabilities: body.capabilities,
      quota_pools: body.quota_pools,
      bundled: body.bundled,
    }),
  };
}

export async function fetchPlatformEntitlement(workspaceId: string, userContext?: PlatformContext): Promise<PlatformEntitlementResult> {
  const context = userContext ?? await workspacePlatformContext(workspaceId);
  if (context.workspaceId !== workspaceId) throw new Error("platform_context_mismatch");
  const res = await platformRequest(`/platform/entitlements?workspace_id=${encodeURIComponent(workspaceId)}&product=arda`, context);
  if (!res.ok) throw new Error(`platform entitlements ${res.status}`);
  const body = await res.json() as EntitlementsResponse;
  validateEntitlementScope(body, workspaceId);
  return parseEntitlementEnvelope(body);
}

export function validateEntitlementScope(value: unknown, workspaceId: string): asserts value is EntitlementsResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("platform_entitlement_invalid");
  const body = value as EntitlementsResponse;
  if (!body || body.workspace_id !== workspaceId || body.product !== "arda"
    || !Object.hasOwn(body, "status") || !Object.hasOwn(body, "tier") || typeof body.bundled !== "boolean") {
    throw new Error("platform_entitlement_invalid");
  }
  if (body.status !== null && typeof body.status !== "string") {
    throw new Error("platform_entitlement_status_invalid");
  }
  if (body.tier !== null && (typeof body.tier !== "string" || !(TIER_ORDER as readonly string[]).includes(body.tier))) {
    throw new Error("platform_entitlement_tier_unknown");
  }
  if (body.limits !== undefined && body.limits !== null) {
    if (typeof body.limits !== "object" || Array.isArray(body.limits)
      || Object.values(body.limits).some(value => value !== null && value !== "unlimited"
        && !(typeof value === "number" && Number.isFinite(value) && (value === -1 || value >= 0)))) {
      throw new Error("platform_entitlement_limits_invalid");
    }
  }
  if (body.quota_pools !== undefined && body.quota_pools !== null
    && (!Array.isArray(body.quota_pools) || body.quota_pools.some(pool => !pool
      || typeof pool.metric !== "string" || !Number.isFinite(pool.limit) || pool.limit < 0
      || !Number.isFinite(pool.remaining)))) {
    throw new Error("platform_entitlement_pools_invalid");
  }
}

function mapToSubscription(body: EntitlementsResponse): Subscription {
  const caps = body.capabilities ?? {};

  // tier: v2 top-level field, else the v1 flat `tier` capability key (the
  // envelope already carries product, reply-01 §6). One of five or null
  // (product_220 §1: null = no direct purchase).
  const rawTier = body.tier !== undefined ? body.tier : caps["tier"];
  const tier: Tier | null =
    typeof rawTier === "string" && (TIER_ORDER as string[]).includes(rawTier)
      ? (rawTier as Tier)
      : null;

  // bundled: an agent Plan bundles arda's data base capability (product_220 §3).
  const bundled = body.bundled === true || caps["bundled"] === true;

  // Raw platform subscription status from the TOP-LEVEL body field, validated
  // against the canonical set (@vxture/shared). Out-of-range/absent -> null
  // (null = never subscribed). NOTE: a value the shared package does not know
  // yet (e.g. past_due before the value-set bump, reply-06 §1.5) lands here as
  // null -> fail closed; widening requires the @vxture/shared upgrade first.
  const rawStatus = body.status !== undefined ? body.status : body.subscription_status;
  const status: SubscriptionStatus | null =
    typeof rawStatus === "string" &&
    (SUBSCRIPTION_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as SubscriptionStatus)
      : null;

  return {
    tier,
    status,
    statusKnown: rawStatus === null || (typeof rawStatus === "string" && (SUBSCRIPTION_STATUSES as readonly string[]).includes(rawStatus)),
    bundled,
    trialEndsAt: body.trial_ends_at ?? null,
    currentPeriodEnd: body.current_period_end ?? null,
    cancelAtPeriodEnd: body.cancel_at_period_end === true,
    dataRetentionUntil: body.data_retention_until ?? null,
  };
}
