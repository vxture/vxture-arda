import type { ReactNode } from "react";
import { canUseFeature } from "./capability";
import { SCREEN_FEATURES } from "./screen-features";
import { getSubscription } from "./server";
import { UpgradePanel } from "./upgrade-panel";

/**
 * Server-side per-screen capability gate (biz-300 stage 0, route-layout layer
 * of the three-layer defense). Visible-but-locked: the nav entry stays, but a
 * locked screen's content is replaced by the upgrade interstitial - evaluated
 * on the server so locked data never reaches the client payload.
 *
 * No feature mapping, or an unlocked tier -> children unchanged. Missing
 * subscription is handled above us (EntitlementGate fail-closed); here we
 * fail-locked to the panel for consistency.
 */
export async function ScreenGate({ screen, children }: { screen: string; children: ReactNode }) {
  const featureKey = SCREEN_FEATURES[screen];
  if (!featureKey) return <>{children}</>;

  const subscription = await getSubscription();
  if (subscription && canUseFeature(subscription, featureKey)) return <>{children}</>;

  return <UpgradePanel screenKey={screen} featureKey={featureKey} />;
}
