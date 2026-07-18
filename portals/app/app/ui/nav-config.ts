/**
 * Console information architecture: launcher functional domains (boards)
 * clustered into horizontal groups, per-domain sidebar menus, and user
 * levels. Labels are i18n KEYS (resolved by the shell via useTranslations),
 * never literals - the only literals here are stable route paths and icon
 * names.
 *
 * Two-layer clustering (arda-biz-107-launcher-clustering):
 *  - Layer 1 (LAUNCHER_GROUPS): the launcher renders as a horizontal grouped
 *    grid, not a long vertical list. 5 groups x a few boards each.
 *  - Layer 2 (BOARDS): several original DCMM/DAMA domains are clustered into a
 *    single board to cut domain-switching. "Data governance" is DISSOLVED - the
 *    whole platform IS governance, so a downgraded standalone governance menu
 *    is not kept: its framework work folds into "design", its operational work
 *    into "operations". The pinned overview is gone too - "data assets" is the
 *    all-hands landing and hosts the asset overview.
 *
 * Each board owns an INDEPENDENT sidebar menu (BOARD_NAV[boardId]); switching
 * boards in the launcher swaps the whole menu. Items with `future: true` route
 * to the under-construction placeholder. Cross-domain actions are page-level
 * deep links, never duplicated nav entries (approvals live only in system
 * administration, service keys only in its API keys, etc.).
 */
import type { PIconName } from "./phosphor-icon";

export interface NavItem {
  /** Stable screen key; also the i18n key under "nav". */
  key: string;
  route: string;
  icon: PIconName;
  /** Not built yet: the route renders the under-construction placeholder. */
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
  /** Launcher group id (i18n key under "launcherGroup"). */
  group: string;
  /** Screen key the launcher jumps to (resolved via ROUTE_BY_KEY). */
  home: string;
  /** Screen keys that belong to this board. */
  screens: string[];
}

/** Layer-1 launcher grouping: horizontal columns, in display order. */
export const LAUNCHER_GROUPS: { key: string }[] = [
  { key: "assetService" },
  { key: "planDesign" },
  { key: "ingestDev" },
  { key: "governControl" },
  { key: "operateAdmin" },
];

/** Functional boards shown in the header launcher, grouped by `group`.
 *  Data assets leads (all-hands landing). 13 boards / 5 groups. */
export const BOARDS: Board[] = [
  // assetService
  {
    id: "assets",
    icon: "stack",
    group: "assetService",
    home: "dashboard",
    screens: ["dashboard", "todo", "catalog", "assetFavorites", "assetRequests", "assetTaxonomy", "assetInventory"],
  },
  { id: "services", icon: "broadcast", group: "assetService", home: "service", screens: ["service", "svcPublish", "svcMonitor", "svcSharing"] },
  // planDesign
  {
    id: "design",
    icon: "map-trifold",
    group: "planDesign",
    home: "planStrategy",
    screens: [
      "planStrategy",
      "planRoadmap",
      "archBusiness",
      "archSubjects",
      "archDataflow",
      "archConceptual",
      "archLogical",
      "archPhysical",
      "archReview",
      "archMetrics",
      "govOrg",
      "govOwners",
      "planSystem",
      "govPolicies",
      "planMaturity",
      "planScorecard",
    ],
  },
  {
    id: "standards",
    icon: "ruler",
    group: "planDesign",
    home: "standards",
    screens: ["standards", "stdCodeSets", "stdDictionary", "stdDocuments", "stdBindings", "stdCompliance", "stdReview"],
  },
  // ingestDev - three independent boards (link / build / develop)
  { id: "integration", icon: "database", group: "ingestDev", home: "sources", screens: ["sources", "intSync", "intRealtime", "intHealth", "intLogs"] },
  { id: "storage", icon: "hard-drives", group: "ingestDev", home: "storIngest", screens: ["storIngest", "storTables", "storJobs"] },
  { id: "engineering", icon: "wrench", group: "ingestDev", home: "etl", screens: ["etl", "engScheduling", "engRuns"] },
  // governControl
  {
    id: "quality",
    icon: "seal-check",
    group: "governControl",
    home: "quality",
    screens: ["quality", "qaTemplates", "qaTasks", "qaResults", "qaAlerts", "qaRemediation", "qaReport"],
  },
  {
    id: "security",
    icon: "lock-key",
    group: "governControl",
    home: "security",
    screens: ["security", "secClassRules", "secLabeling", "secDiscovery", "secMasking", "secAccess", "secRetention", "secApprovals"],
  },
  {
    id: "masterdata",
    icon: "crown-simple",
    group: "governControl",
    home: "masterdata",
    screens: ["mdmModels", "masterdata", "mdmMatching", "mdmQuality", "mdmServices"],
  },
  {
    id: "metadata",
    icon: "tree-structure",
    group: "governControl",
    home: "lineage",
    screens: ["metaMap", "lineage", "metaImpact", "glossary", "metaTags", "metaHarvest", "metaChanges", "metaQuality"],
  },
  // operateAdmin
  {
    id: "operations",
    icon: "pulse",
    group: "operateAdmin",
    home: "operations",
    screens: [
      "operations",
      "opsHeat",
      "opsServiceStats",
      "opsCost",
      "opsReports",
      "govIssues",
      "govRectification",
      "govScorecard",
      "opsCapacity",
      "opsDisposal",
      "opsMonitoring",
      "opsLogs",
    ],
  },
  {
    id: "admin",
    icon: "gear-six",
    group: "operateAdmin",
    home: "approvals",
    screens: ["approvals", "adminFlows", "apikeys", "audit", "adminDict", "adminNotif", "adminPlatform"],
  },
];

/** Each board's OWN sidebar - independent grouped menus.
 *  Group/menu map: arda-biz-107-launcher-clustering. */
export const BOARD_NAV: Record<string, NavGroup[]> = {
  assets: [
    {
      key: "assetHome",
      items: [
        { key: "dashboard", route: "/dashboard", icon: "gauge" },
        { key: "todo", route: "/todo", icon: "list-checks", future: true },
      ],
    },
    {
      key: "assets",
      items: [
        { key: "catalog", route: "/catalog", icon: "stack" },
        { key: "assetFavorites", route: "/catalog/favorites", icon: "star", future: true },
        { key: "assetRequests", route: "/catalog/requests", icon: "clipboard-text", future: true },
      ],
    },
    {
      key: "assetCurate",
      items: [
        { key: "assetTaxonomy", route: "/catalog/taxonomy", icon: "tree-structure", future: true },
        { key: "assetInventory", route: "/catalog/inventory", icon: "chart-bar", future: true },
      ],
    },
  ],
  services: [
    {
      key: "services",
      items: [
        { key: "service", route: "/service", icon: "broadcast" },
        { key: "svcPublish", route: "/service/publish", icon: "export", future: true },
        { key: "svcMonitor", route: "/service/monitor", icon: "pulse", future: true },
        { key: "svcSharing", route: "/service/sharing", icon: "users", future: true },
      ],
    },
  ],
  design: [
    {
      key: "strategyPlanning",
      items: [
        { key: "planStrategy", route: "/planning/strategy", icon: "map-trifold", future: true },
        { key: "planRoadmap", route: "/planning/roadmap", icon: "flow-arrow", future: true },
      ],
    },
    {
      key: "archDesign",
      items: [
        { key: "archBusiness", route: "/architecture/business", icon: "buildings", future: true },
        { key: "archSubjects", route: "/architecture/subjects", icon: "columns", future: true },
        { key: "archDataflow", route: "/architecture/dataflow", icon: "flow-arrow", future: true },
      ],
    },
    {
      key: "modelDesign",
      items: [
        { key: "archConceptual", route: "/architecture/conceptual", icon: "cube", future: true },
        { key: "archLogical", route: "/architecture/logical", icon: "tree-structure", future: true },
        { key: "archPhysical", route: "/architecture/physical", icon: "database", future: true },
        { key: "archReview", route: "/architecture/review", icon: "checks", future: true },
      ],
    },
    {
      key: "metricMgmt",
      items: [{ key: "archMetrics", route: "/architecture/metrics", icon: "chart-bar", future: true }],
    },
    {
      key: "governSystem",
      items: [
        { key: "govOrg", route: "/governance/org", icon: "users-three", future: true },
        { key: "govOwners", route: "/governance/owners", icon: "identification-card", future: true },
        { key: "planSystem", route: "/planning/system", icon: "graph", future: true },
        { key: "govPolicies", route: "/governance/policies", icon: "file-text", future: true },
      ],
    },
    {
      key: "assessment",
      items: [
        { key: "planMaturity", route: "/planning/maturity", icon: "chart-line-up", future: true },
        { key: "planScorecard", route: "/planning/scorecard", icon: "medal", future: true },
      ],
    },
  ],
  standards: [
    {
      key: "stdDefine",
      items: [
        { key: "standards", route: "/standards", icon: "ruler" },
        { key: "stdCodeSets", route: "/standards/code-sets", icon: "table", future: true },
        { key: "stdDictionary", route: "/standards/dictionary", icon: "book-bookmark", future: true },
        { key: "stdDocuments", route: "/standards/documents", icon: "file-text", future: true },
      ],
    },
    {
      key: "stdExecute",
      items: [
        { key: "stdBindings", route: "/standards/bindings", icon: "link", future: true },
        { key: "stdCompliance", route: "/standards/compliance", icon: "seal-check", future: true },
      ],
    },
    {
      key: "stdFlow",
      items: [{ key: "stdReview", route: "/standards/review", icon: "stamp", future: true }],
    },
  ],
  integration: [
    {
      key: "integration",
      items: [
        { key: "sources", route: "/sources", icon: "database" },
        { key: "intSync", route: "/integration/sync", icon: "arrows-clockwise", future: true },
        { key: "intRealtime", route: "/integration/realtime", icon: "lightning", future: true },
        { key: "intHealth", route: "/integration/health", icon: "pulse", future: true },
        { key: "intLogs", route: "/integration/logs", icon: "list-numbers", future: true },
      ],
    },
  ],
  storage: [
    {
      key: "storage",
      items: [
        { key: "storIngest", route: "/storage/ingest", icon: "database", future: true },
        { key: "storTables", route: "/storage/tables", icon: "table", future: true },
        { key: "storJobs", route: "/storage/jobs", icon: "play", future: true },
      ],
    },
  ],
  engineering: [
    {
      key: "engineering",
      items: [
        { key: "etl", route: "/etl", icon: "flow-arrow" },
        { key: "engScheduling", route: "/etl/scheduling", icon: "calendar-blank", future: true },
        { key: "engRuns", route: "/etl/runs", icon: "play", future: true },
      ],
    },
  ],
  quality: [
    {
      key: "qaRules",
      items: [
        { key: "quality", route: "/quality", icon: "seal-check" },
        { key: "qaTemplates", route: "/quality/templates", icon: "table", future: true },
        { key: "qaTasks", route: "/quality/tasks", icon: "play", future: true },
      ],
    },
    {
      key: "qaOutcome",
      items: [
        { key: "qaResults", route: "/quality/results", icon: "list-checks", future: true },
        { key: "qaAlerts", route: "/quality/alerts", icon: "warning", future: true },
        { key: "qaRemediation", route: "/quality/remediation", icon: "wrench", future: true },
      ],
    },
    {
      key: "qaInsight",
      items: [{ key: "qaReport", route: "/quality/report", icon: "chart-bar", future: true }],
    },
  ],
  security: [
    {
      key: "secClassify",
      items: [
        { key: "security", route: "/security", icon: "lock-key" },
        { key: "secClassRules", route: "/security/classification", icon: "shield-check", future: true },
        { key: "secLabeling", route: "/security/labeling", icon: "tag", future: true },
        { key: "secDiscovery", route: "/security/discovery", icon: "scan", future: true },
      ],
    },
    {
      key: "secPolicies",
      items: [
        { key: "secMasking", route: "/security/masking", icon: "eye-slash", future: true },
        { key: "secAccess", route: "/security/access", icon: "lock-key-open", future: true },
        { key: "secRetention", route: "/security/retention", icon: "clock", future: true },
      ],
    },
    {
      key: "secFlow",
      items: [{ key: "secApprovals", route: "/security/approvals", icon: "stamp", future: true }],
    },
  ],
  masterdata: [
    {
      key: "masterdata",
      items: [
        { key: "mdmModels", route: "/masterdata/models", icon: "cube", future: true },
        { key: "masterdata", route: "/masterdata", icon: "crown-simple" },
        { key: "mdmMatching", route: "/masterdata/matching", icon: "arrows-merge", future: true },
        { key: "mdmQuality", route: "/masterdata/quality", icon: "seal-check", future: true },
        { key: "mdmServices", route: "/masterdata/services", icon: "broadcast", future: true },
      ],
    },
  ],
  metadata: [
    {
      key: "metaAssets",
      items: [
        { key: "metaMap", route: "/metadata/map", icon: "map-trifold", future: true },
        { key: "lineage", route: "/lineage", icon: "tree-structure" },
        { key: "metaImpact", route: "/metadata/impact", icon: "arrows-split", future: true },
      ],
    },
    {
      key: "metaSemantics",
      items: [
        { key: "glossary", route: "/glossary", icon: "book-open" },
        { key: "metaTags", route: "/metadata/tags", icon: "tag", future: true },
      ],
    },
    {
      key: "metaOps",
      items: [
        { key: "metaHarvest", route: "/metadata/harvest", icon: "arrows-clockwise", future: true },
        { key: "metaChanges", route: "/metadata/changes", icon: "clock-clockwise", future: true },
        { key: "metaQuality", route: "/metadata/quality", icon: "seal-check", future: true },
      ],
    },
  ],
  operations: [
    {
      key: "opsAnalysis",
      items: [
        { key: "operations", route: "/operations", icon: "gauge", future: true },
        { key: "opsHeat", route: "/operations/heat", icon: "trend-up", future: true },
        { key: "opsServiceStats", route: "/operations/service-stats", icon: "chart-bar", future: true },
        { key: "opsCost", route: "/operations/cost", icon: "coins", future: true },
        { key: "opsReports", route: "/operations/reports", icon: "file-text", future: true },
      ],
    },
    {
      key: "governOps",
      items: [
        { key: "govIssues", route: "/governance/issues", icon: "warning-octagon", future: true },
        { key: "govRectification", route: "/governance/rectification", icon: "wrench", future: true },
        { key: "govScorecard", route: "/governance/scorecard", icon: "medal", future: true },
      ],
    },
    {
      key: "opsCapacityGroup",
      items: [{ key: "opsCapacity", route: "/operations/capacity", icon: "hard-drives", future: true }],
    },
    {
      key: "opsDisposal",
      adminOnly: true,
      items: [{ key: "opsDisposal", route: "/operations/disposal", icon: "archive", future: true }],
    },
    {
      key: "opsRuntime",
      items: [
        { key: "opsMonitoring", route: "/operations/monitoring", icon: "pulse", future: true },
        { key: "opsLogs", route: "/operations/logs", icon: "list-numbers", future: true },
      ],
    },
  ],
  admin: [
    {
      // Approval center is member-facing (my requests) AND approver-facing
      // (pending approvals) - NOT adminOnly, unlike the rest of this board.
      key: "adminFlow",
      items: [{ key: "approvals", route: "/approvals", icon: "stamp", future: true }],
    },
    {
      key: "adminOps",
      adminOnly: true,
      items: [
        { key: "adminFlows", route: "/approvals/config", icon: "gear-six", future: true },
        { key: "apikeys", route: "/apikeys", icon: "lock-key" },
        { key: "audit", route: "/audit", icon: "list-checks" },
        { key: "adminDict", route: "/admin/dictionary", icon: "book-bookmark", future: true },
        { key: "adminNotif", route: "/admin/notifications", icon: "bell", future: true },
        { key: "adminPlatform", route: "/admin/platform", icon: "arrow-square-out", future: true },
      ],
    },
  ],
};

export const NAV_FLAT: NavItem[] = Object.values(BOARD_NAV).flatMap((groups) => groups.flatMap((g) => g.items));

export const ROUTE_BY_KEY: Record<string, string> = Object.fromEntries(NAV_FLAT.map((i) => [i.key, i.route]));

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
