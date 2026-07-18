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

  // arda-biz-106 L2 menu skeleton: planned sub-screens mapped to their
  // domain's EXISTING capability keys (sidebar tier badges + future gating
  // consistency). Screens with no established key stay unlisted until the
  // "key first, then domain" flow (biz-120 SS3.1) assigns one.
  planStrategy: "arda.planning.workbench",
  planRoadmap: "arda.planning.workbench",
  planSystem: "arda.planning.workbench",
  planPolicies: "arda.planning.workbench",
  planMaturity: "arda.planning.workbench",
  planScorecard: "arda.planning.workbench",
  archBusiness: "arda.architecture.workbench",
  archSubjects: "arda.architecture.workbench",
  archDataflow: "arda.architecture.workbench",
  archConceptual: "arda.architecture.workbench",
  archLogical: "arda.architecture.workbench",
  archPhysical: "arda.architecture.workbench",
  archReview: "arda.architecture.workbench",
  archMetrics: "arda.architecture.workbench",
  stdCodeSets: "arda.governance.standards",
  stdDictionary: "arda.governance.standards",
  stdDocuments: "arda.governance.standards",
  stdBindings: "arda.governance.standards",
  stdCompliance: "arda.governance.standards",
  stdReview: "arda.governance.standards",
  metaMap: "arda.governance.lineage",
  metaImpact: "arda.governance.lineage",
  metaTags: "arda.assets.edit_metadata",
  intRealtime: "arda.integration.realtime",
  engScheduling: "arda.integration.scheduling",
  engRuns: "arda.integration.pipelines",
  govOrg: "arda.governance.workbench",
  govOwners: "arda.governance.workbench",
  govPolicies: "arda.governance.workbench",
  govIssues: "arda.governance.workbench",
  govRectification: "arda.governance.workbench",
  govScorecard: "arda.governance.workbench",
  qaTemplates: "arda.governance.quality_rules",
  qaTasks: "arda.governance.quality_rules",
  qaResults: "arda.governance.quality_rules",
  qaAlerts: "arda.governance.quality_rules",
  qaRemediation: "arda.governance.quality_rules",
  qaReport: "arda.governance.quality_rules",
  mdmModels: "arda.governance.master_data",
  mdmMatching: "arda.governance.master_data",
  mdmQuality: "arda.governance.master_data",
  mdmServices: "arda.governance.master_data",
  assetFavorites: "arda.assets.catalog",
  assetRequests: "arda.assets.catalog",
  assetTaxonomy: "arda.assets.edit_metadata",
  assetInventory: "arda.assets.catalog",
  svcPublish: "arda.services.publish_api",
  svcMonitor: "arda.services.publish_api",
  svcSharing: "arda.services.data_products",
  secClassRules: "arda.governance.classification",
  secLabeling: "arda.governance.classification",
  secDiscovery: "arda.governance.classification",
  secMasking: "arda.governance.policies",
  secAccess: "arda.governance.policies",
  secRetention: "arda.governance.policies",
  secApprovals: "arda.governance.policies",
  opsHeat: "arda.operations.dashboard",
  opsServiceStats: "arda.operations.dashboard",
  opsCost: "arda.operations.dashboard",
  opsReports: "arda.operations.dashboard",
  opsCapacity: "arda.operations.dashboard",
  opsDisposal: "arda.operations.dashboard",
  opsMonitoring: "arda.operations.dashboard",
  opsLogs: "arda.operations.dashboard",
};

/** Screens additionally gated by workspace role (owner/admin). Role-locked
 *  screens are HIDDEN from the nav (roles are not purchasable) and the
 *  server-side ScreenGate renders access-denied instead of content. */
export const ADMIN_SCREENS: ReadonlySet<string> = new Set(["apikeys", "audit"]);
