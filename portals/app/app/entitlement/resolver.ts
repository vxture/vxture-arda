import { type ArdaClaim, type ArdaState, type Subscription, type Tier, subscriptionFromClaim } from "./types";
import type { WorkspaceQuota } from "./quota";
import { FREE_PLAN_LIMITS, FREE_QUOTA_POOLS } from "./quota";
import { PlatformEntitlementResolver } from "./platform-resolver";

/** Resolve entitlement for a workspace.
 *  workspaceId is required by PlatformEntitlementResolver (C2 call); MockResolver
 *  ignores it and reads from the token claim / env vars instead. */
export interface EntitlementResolver {
  resolve(claim: ArdaClaim | null, workspaceId?: string): Promise<Subscription>;
  resolveQuota(workspaceId?: string): Promise<WorkspaceQuota>;
  /** Entry checks must not convert transport errors into an unsubscribed fact. */
  resolveFresh?(claim: ArdaClaim | null, workspaceId?: string): Promise<Subscription>;
  /** Evict cached entitlement for workspaceId. Called on subscription_changed events. */
  invalidateCache(workspaceId: string): void;
}

/**
 * Explicit local MOCK_AUTH adapter only. Never selected as a production
 * fallback. A supplied test claim passes through; otherwise use mock settings.
 */
export class MockEntitlementResolver implements EntitlementResolver {
  async resolve(claim: ArdaClaim | null): Promise<Subscription> {
    if (claim) return subscriptionFromClaim(claim);
    const state = (process.env.MOCK_STATE as ArdaState) ?? "subscribed";
    const tier = (process.env.MOCK_TIER as Tier) ?? "pro";
    return subscriptionFromClaim({ state, tier, had_trial: false });
  }

  async resolveQuota(): Promise<WorkspaceQuota> {
    return { limits: FREE_PLAN_LIMITS, bundled: false, pools: FREE_QUOTA_POOLS };
  }

  invalidateCache(_workspaceId: string): void {
    // no-op: MockResolver has no cache
  }
}

/** Missing production configuration must not create a mock subscription. */
let _resolver: EntitlementResolver | null = null;
export function getEntitlementResolver(): EntitlementResolver {
  if (_resolver) return _resolver;
  if (process.env.PLATFORM_API_URL) {
    _resolver = new PlatformEntitlementResolver();
  } else if (process.env.NODE_ENV !== "production" && process.env.MOCK_AUTH === "true") {
    _resolver = new MockEntitlementResolver();
  } else {
    throw new Error("platform_api_unconfigured");
  }
  return _resolver;
}
