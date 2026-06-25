/**
 * The opaque RP session cookie. It carries only the random rpsid (a pointer to
 * the server-side session); no tokens or claims live in the browser.
 *
 * arda is a single host (arda.vxture.com). The cookie is HOST-ONLY: the
 * configured cookieDomain has no leading dot, so it is passed verbatim and the
 * browser scopes the cookie to exactly that host (never to sibling
 * *.vxture.com apps). When no domain is configured (dev) the cookie is
 * host-only by default.
 */
import type { NextRequest, NextResponse } from "next/server";
import type { OidcConfig } from "./config";

export function setSessionCookie(res: NextResponse, cfg: OidcConfig, rpsid: string): void {
  res.cookies.set({
    name: cfg.cookieName,
    value: rpsid,
    httpOnly: true,
    secure: cfg.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: cfg.sessionTtlSeconds,
    // Host-only: never force a leading dot. Empty -> omit -> host-only default.
    domain: cfg.cookieDomain || undefined,
  });
}

export function clearSessionCookie(res: NextResponse, cfg: OidcConfig): void {
  res.cookies.set({
    name: cfg.cookieName,
    value: "",
    httpOnly: true,
    secure: cfg.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    domain: cfg.cookieDomain || undefined,
  });
}

/**
 * Login->callback CSRF binding. Ties the OIDC `state` to the browser that began
 * login: the callback rejects any `state` that does not match this cookie, so a
 * forged callback delivered to a different browser (login CSRF / session
 * fixation) fails. Deliberately host-only and scoped to /auth; it lives only
 * for the short login handshake window.
 */
const LOGIN_STATE_PATH = "/auth";
const LOGIN_STATE_TTL = 600;

function loginStateCookieName(cfg: OidcConfig): string {
  return `${cfg.cookieName}_state`;
}

export function setLoginStateCookie(res: NextResponse, cfg: OidcConfig, state: string): void {
  res.cookies.set({
    name: loginStateCookieName(cfg),
    value: state,
    httpOnly: true,
    secure: cfg.isProd,
    sameSite: "lax",
    path: LOGIN_STATE_PATH,
    maxAge: LOGIN_STATE_TTL,
  });
}

export function clearLoginStateCookie(res: NextResponse, cfg: OidcConfig): void {
  res.cookies.set({
    name: loginStateCookieName(cfg),
    value: "",
    httpOnly: true,
    secure: cfg.isProd,
    sameSite: "lax",
    path: LOGIN_STATE_PATH,
    maxAge: 0,
  });
}

export function readLoginStateCookie(req: NextRequest, cfg: OidcConfig): string {
  return req.cookies.get(loginStateCookieName(cfg))?.value ?? "";
}
