/**
 * Console information architecture: per-domain sidebar menus, launcher
 * functional domains (boards), and user levels. Labels are i18n KEYS
 * (resolved by the shell via useTranslations), never literals - the only
 * literals here are stable route paths and icon names.
 *
 * Domain model (arda-biz-105-capability-map): 1 pinned overview + 14 L1
 * domains adapted from a DCMM/DAMA-DMBOK capability map. Each domain owns an
 * INDEPENDENT sidebar menu (BOARD_NAV[domainId]) - switching domains in the
 * launcher swaps the whole menu, not just the highlighted item. Domains with
 * no shipped screen yet render a roadmap placeholder (see DOMAIN_ROADMAP,
 * ui/placeholder.tsx) rather than being hidden - the full map is demoable
 * now, capabilities land into it by priority later.
 */
import type { PIconName } from "./phosphor-icon";

export interface NavItem {
  /** Stable screen key; also the i18n key under "nav". */
  key: string;
  route: string;
  icon: PIconName;
  /** Not built yet: render the under-construction placeholder. */
  future?: boolean;
}

export interface NavGroup {
  /** i18n key under "navGroup". */
  key: string;
  items: NavItem[];
  /** Role-locked group: hidden for non-admin members (roles are not
   *  purchasable, so visible-but-locked does not apply - biz-250 SS6). */
  adminOnly?: boolean;
}

export interface Board {
  /** Stable id; also the i18n key under "board". */
  id: string;
  icon: PIconName;
  /** Screen key the launcher jumps to. */
  home: string;
  /** Screen keys that belong to this functional domain. */
  screens: string[];
}

/** Functional domains shown in the header launcher, in capability-map order
 *  (0 = pinned overview, 1-14 = the DCMM/DAMA-aligned L1 domains). */
export const BOARDS: Board[] = [
  { id: "overview", icon: "gauge", home: "dashboard", screens: ["dashboard"] },
  { id: "planning", icon: "map-trifold", home: "planning", screens: ["planning"] },
  { id: "architecture", icon: "buildings", home: "architecture", screens: ["architecture"] },
  { id: "standards", icon: "ruler", home: "standards", screens: ["standards"] },
  { id: "metadata", icon: "tree-structure", home: "lineage", screens: ["lineage"] },
  { id: "integration", icon: "database", home: "sources", screens: ["sources"] },
  { id: "engineering", icon: "wrench", home: "etl", screens: ["etl"] },
  { id: "governance", icon: "shield-check", home: "governance", screens: ["governance"] },
  { id: "quality", icon: "seal-check", home: "quality", screens: ["quality"] },
  { id: "masterdata", icon: "crown-simple", home: "masterdata", screens: ["masterdata"] },
  { id: "assets", icon: "stack", home: "catalog", screens: ["catalog", "glossary"] },
  { id: "services", icon: "broadcast", home: "service", screens: ["service"] },
  { id: "security", icon: "lock-key", home: "security", screens: ["security"] },
  { id: "operations", icon: "pulse", home: "operations", screens: ["operations"] },
  { id: "admin", icon: "gear-six", home: "apikeys", screens: ["apikeys", "audit"] },
];

/** Each domain's OWN sidebar - independent menus, not a shared global list. */
export const BOARD_NAV: Record<string, NavGroup[]> = {
  overview: [{ key: "overview", items: [{ key: "dashboard", route: "/dashboard", icon: "gauge" }] }],
  planning: [{ key: "planning", items: [{ key: "planning", route: "/planning", icon: "map-trifold" }] }],
  architecture: [{ key: "architecture", items: [{ key: "architecture", route: "/architecture", icon: "buildings" }] }],
  standards: [{ key: "standards", items: [{ key: "standards", route: "/standards", icon: "ruler" }] }],
  metadata: [{ key: "metadata", items: [{ key: "lineage", route: "/lineage", icon: "tree-structure" }] }],
  integration: [{ key: "integration", items: [{ key: "sources", route: "/sources", icon: "database" }] }],
  engineering: [{ key: "engineering", items: [{ key: "etl", route: "/etl", icon: "flow-arrow" }] }],
  governance: [{ key: "governance", items: [{ key: "governance", route: "/governance", icon: "shield-check" }] }],
  quality: [{ key: "quality", items: [{ key: "quality", route: "/quality", icon: "seal-check" }] }],
  masterdata: [{ key: "masterdata", items: [{ key: "masterdata", route: "/masterdata", icon: "crown-simple" }] }],
  assets: [
    {
      key: "assets",
      items: [
        { key: "catalog", route: "/catalog", icon: "stack" },
        { key: "glossary", route: "/glossary", icon: "book-open" },
      ],
    },
  ],
  services: [{ key: "services", items: [{ key: "service", route: "/service", icon: "broadcast" }] }],
  security: [{ key: "security", items: [{ key: "security", route: "/security", icon: "lock-key" }] }],
  operations: [{ key: "operations", items: [{ key: "operations", route: "/operations", icon: "pulse" }] }],
  admin: [
    {
      key: "admin",
      adminOnly: true,
      items: [
        { key: "apikeys", route: "/apikeys", icon: "lock-key" },
        { key: "audit", route: "/audit", icon: "list-checks" },
      ],
    },
  ],
};

export const NAV_FLAT: NavItem[] = Object.values(BOARD_NAV).flatMap((groups) => groups.flatMap((g) => g.items));

export const ROUTE_BY_KEY: Record<string, string> = Object.fromEntries(NAV_FLAT.map((i) => [i.key, i.route]));

/** L2 roadmap chips shown on a domain's placeholder page (i18n keys under
 *  "domainRoadmap.<domainId>"). Purely descriptive - not yet gated features.
 *  Only domains with NO shipped screen yet render these (round 1); domains
 *  with a real screen (metadata/engineering/services, etc.) do not need an
 *  entry here until their own page grows a roadmap section. */
export const DOMAIN_ROADMAP: Record<string, string[]> = {
  planning: ["strategy", "managementSystem", "maturityAssessment", "governanceOrg", "roadmap", "policySystem", "standardsOfPractice", "scorecard"],
  architecture: ["enterpriseArchitecture", "businessArchitecture", "subjectAreas", "conceptualModel", "logicalModel", "physicalModel", "metricSystem", "dataFlowArchitecture"],
  governance: ["governanceOrg", "dataOwners", "approvalWorkflow", "policySystem", "classificationRules", "lifecyclePolicy", "issueManagement", "governanceScorecard"],
  operations: ["runtimeMonitoring", "resourceMonitoring", "taskMonitoring", "logCenter", "costAnalysis", "dataValueInsight", "assetHeatmap", "serviceStats", "operationsReport"],
};

/** Subscription plan -> short tag shown next to the brand. */
export const PLAN_TAGS: Record<string, string> = {
  free: "FREE",
  starter: "STARTER",
  pro: "PRO",
  business: "BIZ",
  enterprise: "ENT",
};

/** 5 user levels (icon + i18n key under "level"). */
export const USER_LEVELS: Record<number, { key: string; icon: PIconName }> = {
  1: { key: "l1", icon: "user" },
  2: { key: "l2", icon: "user-circle-check" },
  3: { key: "l3", icon: "medal" },
  4: { key: "l4", icon: "shield-check" },
  5: { key: "l5", icon: "crown-simple" },
};
