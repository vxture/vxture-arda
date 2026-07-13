/**
 * Screen -> gating feature key map (biz-300 stage 0, gate UX ruling 2026-07-13).
 *
 * Screens with no entry are always-on (dashboard) or handle themselves (etl
 * renders the future placeholder). Locked screens stay VISIBLE in the nav with
 * a required-tier badge; opening one renders the upgrade interstitial instead
 * of the content (visible-but-locked - never hide, never auto-redirect).
 */

import type { FeatureKey } from "./capability";

export const SCREEN_FEATURES: Partial<Record<string, FeatureKey>> = {
  catalog: "arda.assets.catalog",
  standards: "arda.governance.standards",
  quality: "arda.governance.quality_rules",
  lineage: "arda.governance.lineage",
  security: "arda.governance.policies",
  service: "arda.services.publish_api",
};
