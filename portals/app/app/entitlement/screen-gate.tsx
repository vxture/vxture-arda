import type { ReactNode } from "react";
import { getProductSession as getSession } from "../auth/lib/session";
import { canUseFeature } from "./capability";
import { isWorkspaceAdmin } from "./roles";
import { ADMIN_SCREENS, SCREEN_FEATURES } from "./screen-features";
import { getSubscription } from "./server";
import { AccessDeniedPanel } from "./access-denied-panel";
import { UpgradePanel } from "./upgrade-panel";

/**
 * Server-side per-screen gate (biz-300 stage 0, route-layout layer of the
 * three-layer defense). Two orthogonal axes, both evaluated on the server so
 * locked data never reaches the client payload:
 *
 * - Role axis first (admin screens): non-admins get access-denied. Checked
 *   before the subscription axis - an upgrade prompt would mislead here,
 *   since buying a tier cannot grant a role.
 * - Subscription axis (visible-but-locked): the nav entry stays, but a
 *   feature above the tier renders the upgrade interstitial.
 *
 * No feature mapping, or all axes pass -> children unchanged. Missing
 * subscription is handled above us (EntitlementGate fail-closed); here we
 * fail-locked to the panel for consistency.
 */
export async function ScreenGate({ screen, children }: { screen: string; children: ReactNode }) {
  if (ADMIN_SCREENS.has(screen)) {
    const session = await getSession();
    if (!session || !isWorkspaceAdmin(session.roles)) return <AccessDeniedPanel />;
  }

  const featureKey = SCREEN_FEATURES[screen];
  if (!featureKey) return <>{children}</>;

  const subscription = await getSubscription();
  if (subscription && canUseFeature(subscription, featureKey)) return <>{children}</>;

  return <UpgradePanel screenKey={screen} featureKey={featureKey} />;
}
