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
  /** Evict cached entitlement for workspaceId. Called on subscription_changed events. */
  invalidateCache(workspaceId: string): void;
}

/**
 * Local dev / CI fallback. When PLATFORM_API_URL is not set the app is still
 * usable: a real claim passes through unchanged; absent claim falls back to
 * MOCK_STATE + MOCK_TIER env vars.
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

/**
 * Factory. Switches to PlatformEntitlementResolver (real C2 API call) when
 * PLATFORM_API_URL and PLATFORM_INTERNAL_AUTH_TOKEN are both set; otherwise
 * stays on MockEntitlementResolver so local dev and CI work without secrets.
 */
let _resolver: EntitlementResolver | null = null;

export function getEntitlementResolver(): EntitlementResolver {
  if (_resolver) return _resolver;
  const url = process.env.PLATFORM_API_URL;
  const token = process.env.PLATFORM_INTERNAL_AUTH_TOKEN;
  if (url && token) {
    _resolver = new PlatformEntitlementResolver(url, token);
  } else {
    _resolver = new MockEntitlementResolver();
  }
  return _resolver;
}
