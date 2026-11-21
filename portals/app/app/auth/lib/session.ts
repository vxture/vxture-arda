/**
 * Server-side session resolution shared by the /auth/session route and any
 * server code that needs the current user (e.g. the entitlement route via
 * getSession()).
 *
 * Resolving a session means: opaque rpsid cookie -> stored IdentityClaims in
 * Redis, with a refresh-on-near-expiry rotation. Tokens never leave the server;
 * when the access token is within 60s of expiry we rotate it (refresh_token
 * grant) and keep the same rpsid. Explicit central invalidation destroys the
 * local session; unavailable refresh/status operations retain it but deny work.
 */
import { cookies } from "next/headers";
import { getOidcConfig, type OidcConfig } from "./config";
import { refreshTokens, verifyToken } from "./oidc";
import {
  getIdentity,
  getTokens,
  putRotatedSession,
  putIdentity,
  destroySession,
  withSessionLock,
  type IdentityClaims,
} from "./session-store";
import { toIdentityClaims, toTokenBundle } from "./claims";
import type { ArdaClaim } from "../../entitlement/types";
import type { PlatformContext } from "../../platform/ticket";
import { cache } from "react";
import { checkCentralSession } from "./central-session";
import { admitProductUser } from "../../platform/admission";

export interface SessionResolution {
  /** The current identity claims, or null when there is no valid session. */
  identity: IdentityClaims | null;
  /** True when the caller should clear the opaque session cookie (stale rpsid
   * or central invalidation tore the session down). */
  clearCookie: boolean;
}

/**
 * Core resolver: given the opaque rpsid, return the live identity claims,
 * rotating tokens when the access token is near expiry. Returns clearCookie
 * when the session is gone so route handlers can drop the stale cookie.
 */
export async function resolveIdentity(cfg: OidcConfig, rpsid: string): Promise<SessionResolution> {
  const identity = await getIdentity(cfg, rpsid);
  if (!identity) return { identity: null, clearCookie: true };
  if (process.env.NODE_ENV !== "production" && process.env.MOCK_AUTH === "true") {
    return { identity, clearCookie: false };
  }
  const tokens = await getTokens(cfg, rpsid);
  if (!tokens) throw new Error("session_tokens_unavailable");
  const now = Date.now() / 1000;
  if ((identity.central_next_check_at ?? 0) > now && tokens.access_exp - now > 60) {
    return { identity, clearCookie: false };
  }
  return withSessionLock(cfg, rpsid, () => resolveLockedIdentity(cfg, rpsid));
}

async function resolveLockedIdentity(cfg: OidcConfig, rpsid: string): Promise<SessionResolution> {
  let identity = await getIdentity(cfg, rpsid);
  if (!identity) return { identity: null, clearCookie: true };

  const tokens = await getTokens(cfg, rpsid);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!tokens) throw new Error("session_tokens_unavailable");
  if ((identity.central_next_check_at ?? 0) <= nowSec) {
    const status = await checkCentralSession(cfg, identity.sid);
    if (!status.valid) {
      await destroySession(cfg, rpsid);
      return { identity: null, clearCookie: true };
    }
    identity.central_next_check_at = status.next_check_at;
    await putIdentity(cfg, rpsid, identity);
  }
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
      fresh.central_next_check_at = identity.central_next_check_at;
      await putRotatedSession(cfg, rpsid, fresh, toTokenBundle(rotated, rotatedId));
      identity = fresh;
    } catch {
      // Neither a refresh error nor an IdP outage establishes central logout.
      throw new Error("session_refresh_unavailable");
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
  ardaClaim: ArdaClaim | null;
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
    ardaClaim: identity.arda_claim,
  };
}

/**
 * Server helper: resolve the current request's session from the opaque cookie,
 * or null when unauthenticated / unconfigured. Safe to call from route
 * handlers and server components; it only reads the cookie (Redis-side token
 * rotation may still happen) and never mutates the response cookie.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const cfg = getOidcConfig();
  if (!cfg) return null;

  const store = await cookies();
  const rpsid = store.get(cfg.cookieName)?.value;
  if (!rpsid) return null;

  const { identity } = await resolveIdentity(cfg, rpsid);
  if (!identity) return null;
  return toSession(identity);
});

/** Read the current token after identity resolution/rotation, without exposing it in Session. */
export async function getPlatformUserContext(session: Session): Promise<PlatformContext> {
  const cfg = getOidcConfig();
  if (!cfg) throw new Error("platform_identity_unconfigured");
  const rpsid = (await cookies()).get(cfg.cookieName)?.value;
  if (!rpsid) throw new Error("platform_session_required");
  const tokens = await getTokens(cfg, rpsid);
  if (!tokens || tokens.access_exp <= Date.now() / 1000) throw new Error("platform_session_expired");
  const claims = await verifyToken(cfg, tokens.access_token);
  if (claims.sub !== session.sub || claims.active_org !== session.tenantId || claims.active_workspace !== session.workspaceId) {
    throw new Error("platform_session_scope_changed");
  }
  return { orgId: session.tenantId, workspaceId: session.workspaceId, subject: session.sub, subjectToken: tokens.access_token };
}

/** Request-scoped admission; identity endpoints keep using getSession(). */
export const getProductSession = cache(async (): Promise<Session | null> => {
  const session = await getSession();
  if (!session) return null;
  if (process.env.NODE_ENV !== "production" && process.env.MOCK_AUTH === "true") return session;
  const context = await getPlatformUserContext(session);
  return await admitProductUser(context) ? session : null;
});
