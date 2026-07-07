/**
 * Entitlement domain types for arda.
 *
 * Aligned to platform product_220 (catalog/entitlement/resource model) +
 * arda-plat-210 reply-02:
 *  - tier is one of the five commercial tiers OR null (null = no direct purchase).
 *  - status is the subscription lifecycle: none | trial | subscribed | expired.
 *    "cancelled" is NOT a state - cancel (取消订阅) is an immediate-refund event
 *    that transitions subscribed -> none. Account-level "suspended" rides the
 *    access_token `account_status` claim, not this status.
 *  - bundled is an orthogonal boolean: an agent Plan bundles arda's data base
 *    capability (billing bundled_free) without a standalone arda subscription.
 */

// -- Lifecycle status ---------------------------------------------------------

/** Subscription lifecycle for (workspace, product=arda). Four gating states.
 *  none       - never subscribed, or cleanly cancelled (voluntary exit).
 *  trial      - unpaid trial; time/quota limited.
 *  subscribed - paid subscription active; full service.
 *  expired    - involuntary lapse (renewal unpaid); restricted, dunning.
 *  (suspended is account-level via access_token `account_status`, not here.) */
export type SubscriptionStatus = "none" | "trial" | "subscribed" | "expired";

/** @deprecated legacy alias kept for the token-claim wire format. Same values
 *  as SubscriptionStatus; the claim historically used "free" for "none". */
export type ArdaState = SubscriptionStatus;

// -- Subscription tiers -------------------------------------------------------

/** Commercial subscription tier. Five tiers, and only five (product_220 §1):
 *  free < starter < pro < business < enterprise. The platform is the source of
 *  truth; arda only consumes the value. tier is null when there is no direct
 *  purchase (bundled-only or no subscription). */
export type Tier = "free" | "starter" | "pro" | "business" | "enterprise";

/** Ordered tiers, lowest to highest. The index is the tier rank. */
export const TIER_ORDER: readonly Tier[] = ["free", "starter", "pro", "business", "enterprise"];

/** Numeric rank for a tier (higher = more entitled). */
export function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

/** Whether `tier` satisfies (meets or exceeds) the required `min` tier. */
export function tierMeets(tier: Tier, min: Tier): boolean {
  return tierRank(tier) >= tierRank(min);
}

// -- Arda claim (from access token) -------------------------------------------

/** The `arda` nested object inside the OIDC access token.
 *
 *  Invariants enforced by accounts.vxture.com:
 *    state=trial      -> tier = a platform-configured preview tier
 *    state=subscribed -> tier in {starter, pro, business, enterprise}
 *    state=expired    -> tier = "free" (or null)
 *    state=none       -> tier = "free" (or null); the wire format historically
 *                        sent "free" for this state (mapped to "none" on read). */
export interface ArdaClaim {
  readonly state: ArdaState;
  readonly tier: Tier;
  readonly had_trial: boolean;
}

// -- Subscription (gate-facing view) ------------------------------------------

export interface Subscription {
  /** Direct-purchase tier, or null when there is no standalone subscription. */
  readonly tier: Tier | null;
  /** Lifecycle status (product_220 / reply-02). */
  readonly status: SubscriptionStatus;
  /** True when an agent Plan bundles arda's data base capability (orthogonal to
   *  tier/status). Enables backend/agent data access without a standalone sub. */
  readonly bundled: boolean;
}

/** Product-UI access gate (product_220 §3): a standalone active subscription.
 *  Data-access (agent DataService) additionally accepts bundled - see
 *  hasDataAccess. */
export function hasProductAccess(sub: Subscription): boolean {
  return sub.tier != null && (sub.status === "trial" || sub.status === "subscribed");
}

/** Data-access gate (product_220 §3): standalone active OR bundled. */
export function hasDataAccess(sub: Subscription): boolean {
  return hasProductAccess(sub) || sub.bundled;
}

/** Derive the gate-facing Subscription from an ArdaClaim.
 *  trial / subscribed -> tier from claim, matching status.
 *  expired / none     -> tier null (no active direct purchase), matching status. */
export function subscriptionFromClaim(claim: ArdaClaim): Subscription {
  if (claim.state === "trial" || claim.state === "subscribed") {
    return { tier: claim.tier, status: claim.state, bundled: false };
  }
  if (claim.state === "expired") {
    return { tier: null, status: "expired", bundled: false };
  }
  return { tier: null, status: "none", bundled: false };
}
