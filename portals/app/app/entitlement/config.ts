import type { Tier } from "./types";

/**
 * Entitlement + landing configuration. The default landing page is where an
 * authenticated, entitled user is dropped after entry from an upstream app.
 * Override with the DEFAULT_LANDING env var without a code change.
 */
export const DEFAULT_LANDING: string =
  process.env.DEFAULT_LANDING ?? "/dashboard";

/**
 * Minimum subscription tier required to use the app. Anything below this (or an
 * inactive subscription) is shown the upgrade screen by the EntitlementGate.
 * Override with MIN_TIER (e.g. "team") without a code change.
 */
export const MIN_TIER: Tier = (process.env.MIN_TIER as Tier) ?? "pro";
