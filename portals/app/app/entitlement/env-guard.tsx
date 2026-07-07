"use client";

import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@vxture/design-system";
import { useSession } from "../ui/api";

// Which stack this build targets. Set in next.config at build time from
// NEXT_PUBLIC_APP_ENV ("prod" | "beta"). Defaults to "prod" so the gate is
// permissive when the var is absent (local dev, unit tests).
const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? "prod";
const PROD_URL = process.env.NEXT_PUBLIC_PROD_URL ?? "https://arda.vxture.com";
const BETA_URL = process.env.NEXT_PUBLIC_BETA_URL ?? "https://beta-arda.vxture.com";

/**
 * Environment routing gate. Runs INSIDE AccountGate (session is present).
 *
 * Rules (single-source of truth is ardaClaim.state):
 *   state = "trial"                   -> must be on the beta stack
 *   state = "subscribed|expired|none" -> must be on the prod stack
 *
 * If the user is on the wrong stack, replace the current location with the
 * correct one. The redirect preserves the path so deep links survive.
 * Children never render until the check resolves cleanly.
 */
export function EnvGuard({ children }: { children: ReactNode }) {
  const { loading, session } = useSession();

  useEffect(() => {
    if (loading || !session || session.authenticated === false) return;
    const claim = session.user.ardaClaim;
    if (!claim) return; // no claim = local dev without IdP, skip guard

    const isTrial = claim.state === "trial";
    const onBeta = APP_ENV === "beta";

    if (isTrial && !onBeta) {
      // trial user landed on prod - redirect to beta
      const target = new URL(window.location.pathname + window.location.search, BETA_URL);
      window.location.replace(target.toString());
    } else if (!isTrial && onBeta) {
      // subscribed/expired/free user landed on beta - redirect to prod
      const target = new URL(window.location.pathname + window.location.search, PROD_URL);
      window.location.replace(target.toString());
    }
  }, [loading, session]);

  if (loading) {
    return (
      <div className="env-guard-pending">
        <Skeleton variant="line" lines={3} />
      </div>
    );
  }

  // While a redirect is in flight (wrong stack) keep showing the skeleton so
  // no app content flashes before the navigation completes.
  if (session?.authenticated) {
    const claim = session.user.ardaClaim;
    if (claim) {
      const isTrial = claim.state === "trial";
      const onBeta = APP_ENV === "beta";
      if ((isTrial && !onBeta) || (!isTrial && onBeta)) {
        return (
          <div className="env-guard-pending">
            <Skeleton variant="line" lines={3} />
          </div>
        );
      }
    }
  }

  return <>{children}</>;
}
