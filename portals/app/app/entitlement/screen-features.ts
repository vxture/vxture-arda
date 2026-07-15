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
  glossary: "arda.assets.glossary",
  standards: "arda.governance.standards",
  quality: "arda.governance.quality_rules",
  lineage: "arda.governance.lineage",
  security: "arda.governance.policies",
  service: "arda.services.publish_api",
  sources: "arda.integration.sources_basic",
  apikeys: "arda.admin.api_keys",
  audit: "arda.admin.audit_log",
  // arda-biz-105 new L1 domains (round 1: placeholder shells)
  masterdata: "arda.governance.master_data", // already a real PRO key, only the screen was missing
  planning: "arda.planning.workbench", // future - renders "coming soon", not an upgrade prompt
  architecture: "arda.architecture.workbench", // future
  governance: "arda.governance.workbench", // future
  operations: "arda.operations.dashboard", // future
  // etl (data engineering) intentionally left ungated - unchanged from its
  // pre-existing behavior; it is only moving nav domains this round, not
  // being newly gated (avoid an unintended tier regression).
};

/** Screens additionally gated by workspace role (owner/admin). Role-locked
 *  screens are HIDDEN from the nav (roles are not purchasable) and the
 *  server-side ScreenGate renders access-denied instead of content. */
export const ADMIN_SCREENS: ReadonlySet<string> = new Set(["apikeys", "audit"]);
