import { NextRequest, NextResponse } from "next/server";
import { getOidcConfig } from "../lib/config";
import { createCodeVerifier, challengeFromVerifier, randomToken } from "../lib/pkce";
import { buildAuthorizeUrl } from "../lib/oidc";
import { putAuthRequest } from "../lib/session-store";
import { safeReturnTo } from "../lib/return-to";
import { setLoginStateCookie } from "../lib/cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * OIDC RP login entry. Generates PKCE(S256) + state + nonce, persists them in
 * the server-side authreq record, then top-level redirects to the IdP authorize
 * endpoint. The browser only carries `state` onward; the verifier/nonce stay in
 * Redis. SSO is silent when the central vx_sid is present (the browser is
 * first-party to accounts.vxture.com after this redirect).
 */
export async function GET(request: NextRequest) {
  const cfg = getOidcConfig();
  if (!cfg) {
    return new NextResponse("OIDC RP is not configured", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = createCodeVerifier();
  const codeChallenge = challengeFromVerifier(codeVerifier);

  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"), request, cfg);

  await putAuthRequest(cfg, state, { codeVerifier, nonce, returnTo });

  // Bind `state` to this browser so a forged callback delivered to another
  // browser (login CSRF / session fixation) is rejected at the callback.
  const response = NextResponse.redirect(buildAuthorizeUrl(cfg, { state, nonce, codeChallenge }));
  setLoginStateCookie(response, cfg, state);
  return response;
}
