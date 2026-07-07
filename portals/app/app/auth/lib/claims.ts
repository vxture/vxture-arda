/**
 * Map verified OIDC token payloads onto the stored session shapes. Identity
 * claims come primarily from the access_token (richer tenant context, standard
 * section 7); sid/auth come from the id_token.
 */
import type { JWTPayload } from "jose";
import type { IdentityClaims, TokenBundle } from "./session-store";
import type { TokenSet } from "./oidc";
import { type ArdaClaim, type ArdaState, type Tier, TIER_ORDER } from "../../entitlement/types";

const ARDA_STATES: readonly ArdaState[] = ["trial", "subscribed", "expired", "none"];

/** Normalize a wire state string to an ArdaState. The token claim historically
 *  used "free" for the no-subscription case; map it to "none" (product_220 /
 *  reply-02). Unknown values return null. */
function normalizeState(s: string): ArdaState | null {
  if (s === "free") return "none";
  return (ARDA_STATES as string[]).includes(s) ? (s as ArdaState) : null;
}

/**
 * Parse the `arda` nested claim from the access token.
 *
 * Supports two wire formats:
 *
 * A) Platform format (accounts.vxture.com v1):
 *      { subscribed: boolean, plan: string, status: "active"|"expired"|"none" }
 *    Limitations of this format:
 *      - Cannot distinguish "trial" from "free" (both have subscribed=false).
 *        Until the platform adds a `trial` flag, trial users appear as "free"
 *        and EnvGuard cannot route them to the beta stack automatically.
 *      - `had_trial` is absent; defaults to false.
 *    => Requested platform additions: `trial: boolean`, `had_trial: boolean`.
 *
 * B) Arda-native format (future, once platform aligns):
 *      { state: ArdaState, tier: Tier, had_trial: boolean }
 */
function toArdaClaim(v: unknown): ArdaClaim | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;

  // Format A: platform supplies `subscribed` + `plan` + `status`
  if ("subscribed" in o || "plan" in o) {
    const plan = typeof o.plan === "string" ? o.plan : "free";
    const status = typeof o.status === "string" ? o.status : "active";
    const subscribed = o.subscribed === true;
    const tier: Tier = (TIER_ORDER as string[]).includes(plan) ? (plan as Tier) : "free";

    let state: ArdaState;
    if (subscribed && status === "active") {
      state = "subscribed";
    } else if (status === "expired") {
      state = "expired";
    } else {
      // subscribed=false + status="active"|"none": cannot distinguish trial vs none.
      // Default to "none" until platform adds a `trial` boolean field.
      state = o.trial === true ? "trial" : "none";
    }

    return { state, tier, had_trial: o.had_trial === true };
  }

  // Format B: arda-native { state, tier, had_trial }
  const rawState = typeof o.state === "string" ? o.state : "";
  const state = normalizeState(rawState);
  if (!state) return null;
  const tier = typeof o.tier === "string" ? o.tier : "";
  return {
    state,
    tier: (TIER_ORDER as string[]).includes(tier) ? (tier as Tier) : "free",
    had_trial: o.had_trial === true,
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function bool(v: unknown): boolean {
  return v === true;
}

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean);
  return typeof v === "string" && v ? [v] : [];
}

export function toIdentityClaims(idClaims: JWTPayload, accessClaims: JWTPayload): IdentityClaims {
  const sid = str(idClaims.sid) || str(accessClaims.sid);
  // Live IdP context claim names are org/workspace/roles.
  return {
    sub: str(accessClaims.sub) || str(idClaims.sub),
    sid,
    // name / preferred_username / picture ride the profile scope; email / phone
    // need the email / phone scopes (and an account value) to be present. picture
    // is a cross-domain avatar URL the browser loads directly (never proxied).
    display_name: str(accessClaims.name),
    username: str(accessClaims.preferred_username),
    avatar_url: str(accessClaims.picture),
    email: str(accessClaims.email),
    email_verified: bool(accessClaims.email_verified),
    phone: str(accessClaims.phone),
    phone_verified: bool(accessClaims.phone_verified),
    account_status: str(accessClaims.account_status),
    active_org: str(accessClaims.active_org),
    // active_org_type ("personal" | "team") is the personal-vs-team discriminator
    // (every account has a personal org, so active_org alone cannot tell them
    // apart). Org/workspace display names are shown when the IdP emits them.
    active_org_type: str(accessClaims.active_org_type),
    active_org_name: str(accessClaims.active_org_name),
    active_workspace: str(accessClaims.active_workspace),
    active_workspace_name: str(accessClaims.active_workspace_name),
    roles: strList(accessClaims.roles),
    user_type: str(accessClaims.userType) || str(idClaims.userType),
    exp: typeof accessClaims.exp === "number" ? accessClaims.exp : 0,
    arda_claim: toArdaClaim(accessClaims.arda),
  };
}

export function toTokenBundle(tokens: TokenSet, idClaims: JWTPayload): TokenBundle {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    access_exp: nowSec + (Number.isFinite(tokens.expires_in) ? tokens.expires_in : 900),
    id_claims: idClaims as Record<string, unknown>,
  };
}
