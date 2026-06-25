/**
 * Map verified OIDC token payloads onto the stored session shapes. Identity
 * claims come primarily from the access_token (richer tenant context, standard
 * section 7); sid/auth come from the id_token.
 */
import type { JWTPayload } from "jose";
import type { IdentityClaims, TokenBundle } from "./session-store";
import type { TokenSet } from "./oidc";

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
