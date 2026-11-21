/**
 * The opaque RP session cookie. It carries only the random rpsid (a pointer to
 * the server-side session); no tokens or claims live in the browser.
 *
 * Arda uses a host-only cookie on arda.ruyin.work (or the beta/dev host).
 * Omitting Domain is essential: an explicit Domain, even without a leading
 * dot, is a domain cookie and also covers subdomains of that host.
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
