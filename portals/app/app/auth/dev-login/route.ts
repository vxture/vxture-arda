/**
 * Dev-only login bypass. Requires MOCK_AUTH=true and NODE_ENV != production.
 * Creates a fake RP session directly in Redis (no OIDC flow) and sets the
 * session cookie so the app loads as an authenticated user.
 *
 * URL params (all optional, fall back to env vars):
 *   state     trial | subscribed | expired | none   (default: MOCK_STATE or "subscribed")
 *   tier      free | starter | pro | business | enterprise  (default: MOCK_TIER or "pro")
 *   had_trial true | false                           (default: false)
 *   returnTo  redirect target after login            (default: DEFAULT_LANDING or "/")
 *
 * Quick-switch URLs for manual testing:
 *   /auth/dev-login?state=trial&tier=pro
 *   /auth/dev-login?state=subscribed&tier=business
 *   /auth/dev-login?state=expired
 *   /auth/dev-login?state=none
 */
import { NextRequest, NextResponse } from "next/server";
import { getOidcConfig } from "../lib/config";
import { createSession, type IdentityClaims, type TokenBundle } from "../lib/session-store";
import { setSessionCookie } from "../lib/cookie";
import { type ArdaState, type ArdaClaim, type Tier, TIER_ORDER } from "../../entitlement/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ARDA_STATES: readonly string[] = ["trial", "subscribed", "expired", "none"];

export async function GET(request: NextRequest) {
  if (process.env.MOCK_AUTH !== "true" || process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const cfg = getOidcConfig();
  if (!cfg) {
    return new NextResponse("REDIS_URL not set - cannot create mock session", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const p = request.nextUrl.searchParams;
  const stateParam = p.get("state") ?? process.env.MOCK_STATE ?? "subscribed";
  // Legacy "free" still resolves to the current "none" state.
  const stateRaw = stateParam === "free" ? "none" : stateParam;
  const tierRaw = p.get("tier") ?? process.env.MOCK_TIER ?? "pro";
  const hadTrial = p.get("had_trial") === "true";

  const state: ArdaState = (ARDA_STATES as string[]).includes(stateRaw)
    ? (stateRaw as ArdaState)
    : "subscribed";
  const tier: Tier = (TIER_ORDER as string[]).includes(tierRaw) ? (tierRaw as Tier) : "pro";
  const ardaClaim: ArdaClaim = { state, tier, had_trial: hadTrial };

  // Set access_exp far in the future so the 60s refresh window never fires
  // during a local dev session. Fake tokens are never sent to any IdP.
  const nowSec = Math.floor(Date.now() / 1000);
  const farFuture = nowSec + 86400;

  const identity: IdentityClaims = {
    sub: "dev-user-001",
    sid: "dev-sid-001",
    display_name: "Dev User",
    username: "devuser",
    avatar_url: "",
    email: "dev@vxture.com",
    email_verified: true,
    phone: "",
    phone_verified: false,
    account_status: "active",
    active_org: "dev-org-001",
    active_org_type: "personal",
    active_org_name: "Dev Org",
    active_workspace: "dev-ws-001",
    active_workspace_name: "Dev Workspace",
    roles: ["member"],
    user_type: "user",
    exp: farFuture,
    arda_claim: ardaClaim,
  };

  const tokens: TokenBundle = {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    access_exp: farFuture,
    id_claims: { sub: "dev-user-001", sid: "dev-sid-001" },
  };

  const rpsid = await createSession(cfg, identity, tokens);

  const returnTo = p.get("returnTo") ?? process.env.DEFAULT_LANDING ?? "/dashboard";
  const response = NextResponse.redirect(new URL(returnTo, request.url));
  setSessionCookie(response, cfg, rpsid);
  return response;
}
