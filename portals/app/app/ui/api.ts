"use client";

import { useEffect, useState } from "react";

/**
 * Client-side session DTO and helpers. The session is fetched from the
 * same-origin /auth/session route (the OIDC RP bootstrap endpoint); tokens
 * never reach the browser, only this identity projection.
 */

/** Identity projection returned by /auth/session when authenticated. Mirrors
 * the route's `user` object (camelCase). orgId/workspaceId are the active org
 * and workspace (the entitlement lookup keys). */
export interface SessionUser {
  sub: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
  accountStatus: string;
  orgId: string;
  orgType: string;
  orgName: string;
  workspaceId: string;
  workspaceName: string;
  roles: string[];
  userType: string;
}

/** Response shape of GET /auth/session. */
export type SessionResponse =
  | { authenticated: false }
  | { authenticated: true; user: SessionUser };

/**
 * Build the OIDC RP login entry URL. The server route generates PKCE+state+nonce
 * then top-level redirects to accounts.vxture.com/oidc/authorize. arda is a
 * single host, so the callback lands back on this same origin; we pass
 * returnTo = the current URL (allowlisted to the app host) to resume here after
 * sign-in.
 */
export function ssoStartUrl(): string {
  const params = new URLSearchParams();
  if (typeof window !== "undefined") params.set("returnTo", window.location.href);
  const qs = params.toString();
  return qs ? `/auth/login?${qs}` : "/auth/login";
}

/** Fetch the current session from /auth/session (no-store, credentials). */
export async function fetchSession(): Promise<SessionResponse> {
  const res = await fetch("/auth/session", {
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return { authenticated: false };
  return (await res.json()) as SessionResponse;
}

export interface UseSessionState {
  /** True until the first /auth/session response settles. */
  loading: boolean;
  /** The settled session, or null while loading / on error. */
  session: SessionResponse | null;
}

/**
 * Client hook: load the session once on mount. Treats any error as anonymous
 * (fail closed) so callers can route an unauthenticated visitor to sign-in.
 */
export function useSession(): UseSessionState {
  const [state, setState] = useState<UseSessionState>({ loading: true, session: null });

  useEffect(() => {
    let cancelled = false;
    fetchSession()
      .then((session) => {
        if (!cancelled) setState({ loading: false, session });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, session: { authenticated: false } });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
