/**
 * Client for the vxture platform C2 entitlement endpoint.
 * GET /platform/entitlements?workspace_id={W}&product=arda
 * Auth: x-vxture-internal-auth header (PLATFORM_INTERNAL_AUTH_TOKEN).
 *
 * Response contract: ent-120 §1 (capabilities/quota_pools structure, ADR-11 §11.7).
 * Cache: caller is responsible for short-TTL caching (see PlatformEntitlementResolver).
 */

import type { Subscription, SubscriptionStatus } from "./types";
import type { Tier } from "./types";
import { TIER_ORDER } from "./types";
import { SUBSCRIPTION_STATUSES } from "@vxture/shared";
import type { WorkspaceQuota } from "./quota";
import { mapToWorkspaceQuota } from "./quota";

interface EntitlementsResponse {
  workspace_id: string;
  product: string;
  // Subscription lifecycle is a TOP-LEVEL field (raw platform status), NOT inside
  // capabilities (product_220 / @vxture/shared). null/absent = never subscribed.
  subscription_status?: string | null;
  capabilities: Record<string, unknown>;
  quota_pools: Array<{ metric: string; limit: number; remaining: number; priority: number }>;
}

export interface PlatformEntitlementResult {
  subscription: Subscription;
  quota: WorkspaceQuota;
}

export async function fetchPlatformEntitlement(
  workspaceId: string,
  baseUrl: string,
  authToken: string,
): Promise<PlatformEntitlementResult> {
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
  return {
    subscription: mapToSubscription(body),
    quota: mapToWorkspaceQuota(body.capabilities ?? {}, body.quota_pools ?? []),
  };
}

function mapToSubscription(body: EntitlementsResponse): Subscription {
  const caps = body.capabilities ?? {};

  // Platform emits tier as a flat key `tier` (NOT `data.tier`/`{product}.tier`) -
  // the envelope already carries product (reply-01 §6). tier is one of five or
  // null (product_220 §1: null = no direct purchase).
  const rawTier = caps["tier"];
  const tier: Tier | null =
    typeof rawTier === "string" && (TIER_ORDER as string[]).includes(rawTier)
      ? (rawTier as Tier)
      : null;

  // bundled: an agent Plan bundles arda's data base capability (product_220 §3).
  const bundled = caps["bundled"] === true;

  // Raw platform subscription status from the TOP-LEVEL body field, validated
  // against the canonical set (@vxture/shared). Out-of-range/absent -> null
  // (null = never subscribed).
  const rawStatus = body.subscription_status;
  const status: SubscriptionStatus | null =
    typeof rawStatus === "string" &&
    (SUBSCRIPTION_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as SubscriptionStatus)
      : null;

  return { tier, status, bundled };
}
