/**
 * Console information architecture: sidebar nav groups, launcher functional
 * domains (boards), and user levels. Labels are i18n KEYS (resolved by the shell
 * via useTranslations), never literals - the only literals here are stable route
 * paths and icon names.
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
   *  purchasable, so visible-but-locked does not apply - biz-250 §6). */
  adminOnly?: boolean;
}

export const NAV: NavGroup[] = [
  {
    key: "overview",
    items: [{ key: "dashboard", route: "/dashboard", icon: "gauge" }],
  },
  {
    key: "assets",
    items: [
      { key: "catalog", route: "/catalog", icon: "stack" },
      { key: "standards", route: "/standards", icon: "ruler" },
      { key: "quality", route: "/quality", icon: "seal-check" },
      { key: "lineage", route: "/lineage", icon: "tree-structure" },
      { key: "security", route: "/security", icon: "lock-key" },
    ],
  },
  {
    key: "sharing",
    items: [
      { key: "sources", route: "/sources", icon: "database" },
      { key: "service", route: "/service", icon: "broadcast" },
      { key: "etl", route: "/etl", icon: "flow-arrow" },
    ],
  },
  {
    key: "admin",
    adminOnly: true,
    items: [
      { key: "apikeys", route: "/apikeys", icon: "lock-key" },
      { key: "audit", route: "/audit", icon: "list-checks" },
    ],
  },
];

export const NAV_FLAT: NavItem[] = NAV.flatMap((g) => g.items);

export interface Board {
  /** Stable id; also the i18n key under "board". */
  id: string;
  icon: PIconName;
  /** Screen key the launcher jumps to. */
  home: string;
  /** Screen keys that belong to this functional domain. */
  screens: string[];
}

/** Functional domains shown in the header launcher. */
export const BOARDS: Board[] = [
  { id: "asset", icon: "stack", home: "dashboard", screens: ["dashboard", "catalog"] },
  { id: "integrate", icon: "flow-arrow", home: "sources", screens: ["sources", "etl"] },
  { id: "govern", icon: "shield-check", home: "standards", screens: ["standards", "quality", "security"] },
  { id: "analyze", icon: "chart-line-up", home: "lineage", screens: ["lineage"] },
  { id: "serve", icon: "broadcast", home: "service", screens: ["service"] },
  { id: "admin", icon: "gear-six", home: "apikeys", screens: ["apikeys", "audit"] },
];

export const ROUTE_BY_KEY: Record<string, string> = Object.fromEntries(
  NAV_FLAT.map((i) => [i.key, i.route]),
);

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
