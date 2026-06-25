/**
 * Entitlement domain types. Arda authenticates a user (via the auth pillar),
 * then checks a subscription tier before landing them on the default page.
 *
 * IMPORTANT: Vxture access tokens do NOT carry entitlement claims (Identity
 * Platform section 6.3). Entitlement is therefore an out-of-band lookup keyed
 * by tenant/workspace, never decoded from the session token. See resolver.ts.
 */

export type Tier = "free" | "pro" | "team" | "enterprise";

export type SubscriptionStatus = "active" | "none" | "expired";

export interface Subscription {
  readonly tier: Tier;
  readonly status: SubscriptionStatus;
}

/** Ordered tiers, lowest to highest. The index is the tier rank. */
export const TIER_ORDER: readonly Tier[] = ["free", "pro", "team", "enterprise"];

/** Numeric rank for a tier (higher = more entitled). */
export function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

/** Whether `tier` satisfies (meets or exceeds) the required `min` tier. */
export function tierMeets(tier: Tier, min: Tier): boolean {
  return tierRank(tier) >= tierRank(min);
}
