/**
 * Server-side session resolution shared by the /auth/session route and any
 * server code that needs the current user (e.g. the entitlement route via
 * getSession()).
 *
 * Resolving a session means: opaque rpsid cookie -> stored IdentityClaims in
 * Redis, with a refresh-on-near-expiry rotation. Tokens never leave the server;
 * when the access token is within 60s of expiry we rotate it (refresh_token
 * grant) and keep the same rpsid. A revoked refresh family tears the local
 * session down.
 */
import { cookies } from "next/headers";
import { getOidcConfig, type OidcConfig } from "./config";
import { refreshTokens, verifyToken } from "./oidc";
import {
  getIdentity,
  getTokens,
  putTokens,
  putIdentity,
  destroySession,
  type IdentityClaims,
} from "./session-store";
import { toIdentityClaims, toTokenBundle } from "./claims";

export interface SessionResolution {
  /** The current identity claims, or null when there is no valid session. */
  identity: IdentityClaims | null;
  /** True when the caller should clear the opaque session cookie (stale rpsid
   * or a refresh failure tore the session down). */
  clearCookie: boolean;
}

/**
 * Core resolver: given the opaque rpsid, return the live identity claims,
 * rotating tokens when the access token is near expiry. Returns clearCookie
 * when the session is gone so route handlers can drop the stale cookie.
 */
export async function resolveIdentity(cfg: OidcConfig, rpsid: string): Promise<SessionResolution> {
  let identity = await getIdentity(cfg, rpsid);
  if (!identity) return { identity: null, clearCookie: true };

  const tokens = await getTokens(cfg, rpsid);
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokens && tokens.access_exp - nowSec <= 60) {
    try {
      const rotated = await refreshTokens(cfg, tokens.refresh_token);
      const rotatedId = await verifyToken(cfg, rotated.id_token);
      const rotatedAccess = await verifyToken(cfg, rotated.access_token);
      if (!rotatedId.sub || rotatedId.sub !== rotatedAccess.sub) throw new Error("subject mismatch");
      // Refresh re-derives identity so role/org changes take effect without a
      // full re-login; the subject must stay the same and the sid (back-channel
      // logout index) is preserved if the rotated id_token omits it.
      const fresh = toIdentityClaims(rotatedId, rotatedAccess);
      if (fresh.sub !== identity.sub) throw new Error("subject changed on refresh");
      if (!fresh.sid) fresh.sid = identity.sid;
      else if (fresh.sid !== identity.sid) throw new Error("sid changed on refresh");
      await putIdentity(cfg, rpsid, fresh);
      await putTokens(cfg, rpsid, toTokenBundle(rotated, rotatedId));
      identity = fresh;
    } catch {
      await destroySession(cfg, rpsid);
      return { identity: null, clearCookie: true };
    }
  }

  return { identity, clearCookie: false };
}

/** Typed session returned by getSession(). tenantId is the active org and
 * workspaceId is the active workspace (the entitlement lookup keys). */
export interface Session {
  sub: string;
  sid: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
  accountStatus: string;
  tenantId: string;
  orgType: string;
  orgName: string;
  workspaceId: string;
  workspaceName: string;
  roles: string[];
  userType: string;
}

export function toSession(identity: IdentityClaims): Session {
  return {
    sub: identity.sub,
    sid: identity.sid,
    displayName: identity.display_name,
    username: identity.username,
    avatarUrl: identity.avatar_url,
    email: identity.email,
    emailVerified: identity.email_verified,
    phone: identity.phone,
    phoneVerified: identity.phone_verified,
    accountStatus: identity.account_status,
    tenantId: identity.active_org,
    orgType: identity.active_org_type,
    orgName: identity.active_org_name,
    workspaceId: identity.active_workspace,
    workspaceName: identity.active_workspace_name,
    roles: identity.roles,
    userType: identity.user_type,
  };
}

/**
 * Server helper: resolve the current request's session from the opaque cookie,
 * or null when unauthenticated / unconfigured. Safe to call from route
 * handlers and server components; it only reads the cookie (Redis-side token
 * rotation may still happen) and never mutates the response cookie.
 */
export async function getSession(): Promise<Session | null> {
  const cfg = getOidcConfig();
  if (!cfg) return null;

  const store = await cookies();
  const rpsid = store.get(cfg.cookieName)?.value;
  if (!rpsid) return null;

  const { identity } = await resolveIdentity(cfg, rpsid);
  if (!identity) return null;
  return toSession(identity);
}
