import { NextRequest, NextResponse } from "next/server";
import { getOidcConfig } from "../lib/config";
import { resolveIdentity } from "../lib/session";
import { clearSessionCookie } from "../lib/cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ANON = { authenticated: false } as const;
// Identity-bearing responses must never be cached by the browser or any proxy.
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Bootstrap endpoint: resolves the opaque session cookie to the current user's
 * identity claims. Tokens never leave the server; when the access token is
 * within 60s of expiry the shared resolver rotates it (refresh_token grant) and
 * keeps the same rpsid cookie. A revoked refresh family tears the local session
 * down and clears the cookie.
 */
export async function GET(request: NextRequest) {
  const cfg = getOidcConfig();
  if (!cfg) return NextResponse.json(ANON, { status: 200, headers: NO_STORE });

  const rpsid = request.cookies.get(cfg.cookieName)?.value;
  if (!rpsid) return NextResponse.json(ANON, { status: 200, headers: NO_STORE });

  const { identity, clearCookie } = await resolveIdentity(cfg, rpsid);
  if (!identity) {
    const res = NextResponse.json(ANON, { status: 200, headers: NO_STORE });
    if (clearCookie) clearSessionCookie(res, cfg);
    return res;
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        sub: identity.sub,
        displayName: identity.display_name,
        username: identity.username,
        avatarUrl: identity.avatar_url,
        email: identity.email,
        emailVerified: identity.email_verified,
        phone: identity.phone,
        phoneVerified: identity.phone_verified,
        accountStatus: identity.account_status,
        orgId: identity.active_org,
        orgType: identity.active_org_type,
        orgName: identity.active_org_name,
        workspaceId: identity.active_workspace,
        workspaceName: identity.active_workspace_name,
        roles: identity.roles,
        userType: identity.user_type,
      },
    },
    { headers: NO_STORE },
  );
}
