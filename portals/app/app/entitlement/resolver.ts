import type { Subscription, Tier } from "./types";

/**
 * Context for an entitlement lookup. Entitlement is keyed by tenant/workspace
 * (NOT by the access token, which carries no entitlement claims), so the caller
 * resolves these identifiers from the session before asking.
 */
export interface EntitlementContext {
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly app: "arda";
}

export interface EntitlementResolver {
  resolve(ctx: EntitlementContext): Promise<Subscription>;
}

/**
 * Stand-in resolver used until the real Vxture commerce/entitlement service is
 * wired. Returns an active subscription at MOCK_TIER (default "pro") regardless
 * of tenant/workspace, so the shell + overview page are reachable in dev.
 */
export class MockEntitlementResolver implements EntitlementResolver {
  async resolve(_ctx: EntitlementContext): Promise<Subscription> {
    const tier = (process.env.MOCK_TIER as Tier) ?? "pro";
    return { tier, status: "active" };
  }
}

/**
 * Factory for the active entitlement resolver. Returns the Mock for now.
 *
 * TODO(commerce): swap this for the real Vxture commerce/entitlement resolver
 * (an out-of-band lookup against the subscription service, keyed by
 * tenant/workspace per Identity Platform section 6.3). The signature is stable,
 * so only this factory body changes.
 */
export function getEntitlementResolver(): EntitlementResolver {
  return new MockEntitlementResolver();
}
