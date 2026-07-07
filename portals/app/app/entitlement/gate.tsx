"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, EmptyState, Icon, Skeleton } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { type Subscription, hasProductAccess } from "./types";

type GateState =
  | { phase: "loading" }
  | { phase: "ready"; subscription: Subscription }
  | { phase: "error" };

/**
 * Subscription gate. Renders INSIDE the AccountGate, so a session is already
 * present; here we only check entitlement. We fetch the workspace's
 * subscription from /api/entitlement (an out-of-band lookup - tokens carry no
 * entitlement claims) and, unless it is active, show a DS upgrade screen.
 */
export function EntitlementGate({ children }: { children: ReactNode }) {
  const t = useTranslations("entitlement");
  const [state, setState] = useState<GateState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/entitlement", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`entitlement ${res.status}`);
        return res.json() as Promise<Subscription>;
      })
      .then((subscription) => {
        if (!cancelled) setState({ phase: "ready", subscription });
      })
      .catch(() => {
        if (!cancelled) setState({ phase: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase === "loading") {
    return (
      <div className="entitlement-pending">
        <Skeleton variant="line" lines={3} />
      </div>
    );
  }

  // Treat an error the same as "not entitled": fail closed to the upgrade
  // screen rather than leaking the workspace on an inconclusive check.
  // Product-UI access = a standalone active subscription (product_220 §3).
  const active =
    state.phase === "ready" && hasProductAccess(state.subscription);

  if (!active) {
    return (
      <div className="entitlement-pending">
        <EmptyState
          title={t("title")}
          description={t("description")}
          action={
            <Button asChild variant="default">
              <a href="https://vxture.com/legal/terms" rel="noreferrer">
                <Icon name="sparkles" size="sm" />
                {t("upgrade")}
              </a>
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
