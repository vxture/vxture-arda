/**
 * Client for the vxture platform C2 entitlement endpoint.
 * GET /platform/entitlements?workspace_id={W}&product=arda
 * Auth: x-vxture-internal-auth header (PLATFORM_INTERNAL_AUTH_TOKEN).
 *
 * Response contract: ent-120 §1 (capabilities/quota_pools structure, ADR-11 §11.7).
 * Cache: caller is responsible for short-TTL caching (see PlatformEntitlementResolver).
 */

import type { Subscription } from "./types";
import type { Tier } from "./types";
import { TIER_ORDER } from "./types";
import type { WorkspaceQuota } from "./quota";
import { mapToWorkspaceQuota } from "./quota";

interface EntitlementsResponse {
  workspace_id: string;
  product: string;
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
  // the envelope already carries product (reply-01 §6; product_310 P2.1 note).
  const rawTier = caps["tier"];
  const tier: Tier =
    typeof rawTier === "string" && (TIER_ORDER as string[]).includes(rawTier)
      ? (rawTier as Tier)
      : "free";

  // No subscription: platform returns { tier: null, features: [], quota_pools: [] }
  if (caps["tier"] === null || caps["tier"] === undefined) {
    return { tier: "free", status: "none" };
  }

  return { tier, status: "active" };
}
