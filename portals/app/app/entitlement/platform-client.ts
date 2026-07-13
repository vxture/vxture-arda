/**
 * Client for the vxture platform C2 entitlement endpoint.
 * GET /platform/entitlements?workspace_id={W}&product=arda
 * Auth: x-vxture-internal-auth header (PLATFORM_INTERNAL_AUTH_TOKEN).
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
import { assertInternalTarget } from "../lib/internal-target";

interface EntitlementsResponse {
  workspace_id: string;
  product: string;
  // Subscription lifecycle is a TOP-LEVEL field (raw platform status), NOT inside
  // capabilities (product_220 / @vxture/shared). null/absent = never subscribed.
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

export async function fetchPlatformEntitlement(
  workspaceId: string,
  baseUrl: string,
  authToken: string,
): Promise<PlatformEntitlementResult> {
  // Fail fast rather than leak the S2S secret to a public host (plat-220 §4/B1).
  assertInternalTarget(baseUrl);
  const url = `${baseUrl}/platform/entitlements?workspace_id=${encodeURIComponent(workspaceId)}&product=arda`;

  const res = await fetch(url, {
    headers: {
      "x-vxture-internal-auth": authToken,
      "accept": "application/json",
    },
    // Respect the platform's Cache-Control: private, max-age=45
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`platform entitlements ${res.status}`);
  }

  const body = (await res.json()) as EntitlementsResponse;
  return parseEntitlementEnvelope(body);
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
  const rawStatus = body.subscription_status;
  const status: SubscriptionStatus | null =
    typeof rawStatus === "string" &&
    (SUBSCRIPTION_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as SubscriptionStatus)
      : null;

  return {
    tier,
    status,
    bundled,
    trialEndsAt: body.trial_ends_at ?? null,
    currentPeriodEnd: body.current_period_end ?? null,
    cancelAtPeriodEnd: body.cancel_at_period_end === true,
    dataRetentionUntil: body.data_retention_until ?? null,
  };
}
