"use client";

import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@vxture/design-system";
import { ssoStartUrl, useSession } from "./api";

/**
 * Session gate for the whole app. Loads /auth/session once on mount. Anonymous
 * visitors are bounced to the unified Vxture sign-in (no app-owned login page);
 * children render only once a session is present, so everything below
 * (EntitlementGate, the app shell) can assume an authenticated user.
 *
 * arda is a single host: the OIDC callback lands back on this same origin, so a
 * top-level navigation to /auth/login?returnTo=<current> resumes here after
 * sign-in. On sign-in failure the callback lands on the app home with ?sso=...,
 * so this cannot loop forever.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const { loading, session } = useSession();
  const authenticated = session?.authenticated === true;

  useEffect(() => {
    if (!loading && session && !session.authenticated) {
      window.location.assign(ssoStartUrl());
    }
  }, [loading, session]);

  if (loading || !authenticated) {
    // Loading, or anonymous and about to be redirected to sign-in: show a
    // lightweight placeholder rather than any app surface.
    return (
      <div className="account-gate-pending">
        <Skeleton variant="line" lines={3} />
      </div>
    );
  }

  return <>{children}</>;
}
