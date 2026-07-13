/**
 * Entitlement domain types for arda.
 *
 * Aligned to platform product_220 + @vxture/shared 1.3.0 (canonical value sets):
 *  - Tier and SubscriptionStatus are imported from @vxture/shared (the platform
 *    is the single source of truth for these value sets). arda does not redefine
 *    them locally.
 *  - Subscription.status is the RAW platform status (SubscriptionStatus) or null
 *    (null = never subscribed). Product-UI access = status in {active, trialing}.
 *  - ArdaState/ArdaClaim are LOCAL MOCK-ONLY since the platform retired the
 *    `arda` token claim (arda_305 cutover, 2026-07-14): production tokens carry
 *    zero commercial fields; these types survive solely for dev-login /
 *    MOCK_STATE fallback. EnvGuard (their former consumer) is removed.
 *  - bundled is orthogonal: an agent Plan bundles arda's data base capability.
 */

import type { SubscriptionStatus, Tier } from "@vxture/shared";

// Re-export the platform value-set types so local consumers keep importing from
// "./types" (single import surface for the entitlement module).
export type { SubscriptionStatus, Tier } from "@vxture/shared";

// -- Subscription tiers (order helpers; value set from @vxture/shared) ---------

/** Ordered tiers, lowest to highest. The index is the tier rank.
 *  Five tiers, and only five (product_220 §1). */
export const TIER_ORDER: readonly Tier[] = ["free", "starter", "pro", "business", "enterprise"];

/** Numeric rank for a tier (higher = more entitled). */
export function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

/** Whether `tier` satisfies (meets or exceeds) the required `min` tier. */
export function tierMeets(tier: Tier, min: Tier): boolean {
  return tierRank(tier) >= tierRank(min);
}

// -- Deploy-stack routing hint (separate axis, NOT entitlement) ---------------

/** Former deploy-stack routing hint from the retired `arda` claim. Survives
 *  only as the dev-login / MOCK_STATE vocabulary (real tokens no longer carry
 *  it; EnvGuard is removed). Does not gate access - that is
 *  Subscription.status (from C2). */
export type ArdaState = "trial" | "subscribed" | "expired" | "none";

/** The `arda` nested object inside the OIDC access token. `state` is the routing
 *  hint (above); `tier` seeds the mock/dev fallback Subscription. */
export interface ArdaClaim {
  readonly state: ArdaState;
  readonly tier: Tier;
  readonly had_trial: boolean;
}

// -- Subscription (gate-facing view) ------------------------------------------

export interface Subscription {
  /** Direct-purchase tier, or null when there is no standalone subscription. */
  readonly tier: Tier | null;
  /** Raw platform subscription status (SubscriptionStatus), or null = never
   *  subscribed (product_220 / @vxture/shared). */
  readonly status: SubscriptionStatus | null;
  /** True when an agent Plan bundles arda's data base capability (orthogonal to
   *  tier/status). Enables backend/agent data access without a standalone sub. */
  readonly bundled: boolean;
  // -- Lifecycle timestamps (ent-120 v2, descriptive facts rendered verbatim;
  //    absent until the platform ships the v2 envelope - UX degrades hidden) --
  /** ISO date the trial ends (status=trialing). Countdown banner UX. */
  readonly trialEndsAt?: string | null;
  /** ISO date the current billing period ends (active / grace UX). */
  readonly currentPeriodEnd?: string | null;
  /** Cancellation scheduled: active now, lapses at period end. */
  readonly cancelAtPeriodEnd?: boolean;
  /** ISO date expired data is retained until (platform wipe schedule). */
  readonly dataRetentionUntil?: string | null;
}

/** Statuses that grant product-UI access. `overdue` (dunning grace, arda_303
 *  §1.3: payment failed, entitlement RETAINED while the platform retries) is
 *  included forward-ready: the value only survives envelope validation once
 *  @vxture/shared ships the six-value set (1.4.0), so this is inert until the
 *  dependency upgrade lands. `suspended` (ops freeze) and `expired` block.
 *  Typed as plain strings so the list compiles against both value-set
 *  versions (evolution-tolerance clause, arda_303 §1.3). */
const PRODUCT_ACCESS_STATUSES: readonly string[] = ["active", "trialing", "overdue"];

/** Product-UI access gate (product_220 §3 + arda_303 §1.3). */
export function hasProductAccess(sub: Subscription): boolean {
  return sub.status !== null && PRODUCT_ACCESS_STATUSES.includes(sub.status);
}

/** Data-access gate (product_220 §3): product-UI access OR bundled. */
export function hasDataAccess(sub: Subscription): boolean {
  return hasProductAccess(sub) || sub.bundled;
}

/** Derive a gate-facing Subscription from an ArdaClaim (mock/dev fallback only;
 *  real entitlement comes from C2). Maps the routing-hint state to a raw status:
 *  trial -> trialing, subscribed -> active, expired/none -> null. */
export function subscriptionFromClaim(claim: ArdaClaim): Subscription {
  const status: SubscriptionStatus | null =
    claim.state === "trial"
      ? "trialing"
      : claim.state === "subscribed"
        ? "active"
        : null;
  return { tier: status ? claim.tier : null, status, bundled: false };
}
