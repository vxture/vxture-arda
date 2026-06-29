"use client";

/**
 * Arda-local Phosphor icon wrapper.
 *
 * The DS `Icon` component exposes a curated 81-name set; the console design
 * needs a wider Phosphor vocabulary (domain + nav glyphs). Rather than load the
 * Phosphor web font, we map the names we use to tree-shaken React components
 * from `@phosphor-icons/react`. Prefer the DS `Icon` where a name exists; reach
 * for `<PIcon>` only for glyphs the DS does not provide.
 *
 * `name` is the Phosphor kebab name (the design's `ph-<name>` without the
 * prefix); `weight="fill"` mirrors the design's `ph-fill` usage.
 */
import type { ComponentType } from "react";
import {
  AppWindow,
  ArrowRight,
  ArrowsClockwise,
  ArrowsMerge,
  ArrowsSplit,
  ArrowSquareOut,
  BookOpen,
  Clock,
  Link as LinkIcon,
  ListNumbers,
  ArrowUp,
  ArrowDown,
  Bell,
  Broadcast,
  Buildings,
  Bus,
  CalendarBlank,
  CaretDoubleDown,
  CaretDoubleUp,
  CaretDown,
  CaretRight,
  ChartLineUp,
  Check,
  Checks,
  ClockClockwise,
  Columns,
  CrownSimple,
  Database,
  DotsNine,
  EyeSlash,
  Export,
  FlowArrow,
  Funnel,
  Gauge,
  GearSix,
  GitPullRequest,
  Globe,
  IdentificationCard,
  Lightning,
  ListChecks,
  LockKey,
  LockKeyOpen,
  MagnifyingGlass,
  MagnifyingGlassPlus,
  MapTrifold,
  Medal,
  Minus,
  Play,
  Plus,
  Prohibit,
  Pulse,
  Question,
  Rows,
  Ruler,
  Scan,
  SealCheck,
  Shield,
  ShieldCheck,
  SignOut,
  Sparkle,
  Star,
  Stack,
  Sun,
  TextAa,
  TextIndent,
  TextOutdent,
  Table,
  Timer,
  CornersOut,
  TrafficCone,
  TreeStructure,
  TrendDown,
  TrendUp,
  User,
  UserCircleCheck,
  Users,
  UsersThree,
  UserSwitch,
  Warning,
  WarningOctagon,
  Wrench,
  X,
  type IconProps,
  type IconWeight,
} from "@phosphor-icons/react";

const ICONS = {
  "app-window": AppWindow,
  "arrow-right": ArrowRight,
  "arrows-clockwise": ArrowsClockwise,
  "arrows-merge": ArrowsMerge,
  "arrows-split": ArrowsSplit,
  "arrow-square-out": ArrowSquareOut,
  "arrow-up": ArrowUp,
  "arrow-down": ArrowDown,
  bell: Bell,
  "book-open": BookOpen,
  broadcast: Broadcast,
  buildings: Buildings,
  bus: Bus,
  "calendar-blank": CalendarBlank,
  "caret-double-down": CaretDoubleDown,
  "caret-double-up": CaretDoubleUp,
  "caret-down": CaretDown,
  "caret-right": CaretRight,
  "chart-line-up": ChartLineUp,
  check: Check,
  checks: Checks,
  clock: Clock,
  "clock-clockwise": ClockClockwise,
  columns: Columns,
  "corners-out": CornersOut,
  "crown-simple": CrownSimple,
  database: Database,
  "dots-nine": DotsNine,
  "eye-slash": EyeSlash,
  export: Export,
  "flow-arrow": FlowArrow,
  funnel: Funnel,
  gauge: Gauge,
  "gear-six": GearSix,
  "git-pull-request": GitPullRequest,
  globe: Globe,
  "identification-card": IdentificationCard,
  lightning: Lightning,
  link: LinkIcon,
  "list-checks": ListChecks,
  "list-numbers": ListNumbers,
  "lock-key": LockKey,
  "lock-key-open": LockKeyOpen,
  "magnifying-glass": MagnifyingGlass,
  "magnifying-glass-plus": MagnifyingGlassPlus,
  "map-trifold": MapTrifold,
  medal: Medal,
  minus: Minus,
  play: Play,
  plus: Plus,
  prohibit: Prohibit,
  pulse: Pulse,
  question: Question,
  rows: Rows,
  ruler: Ruler,
  scan: Scan,
  "seal-check": SealCheck,
  shield: Shield,
  "shield-check": ShieldCheck,
  "sign-out": SignOut,
  sparkle: Sparkle,
  star: Star,
  stack: Stack,
  sun: Sun,
  table: Table,
  "text-aa": TextAa,
  "text-indent": TextIndent,
  "text-outdent": TextOutdent,
  timer: Timer,
  "traffic-cone": TrafficCone,
  "tree-structure": TreeStructure,
  "trend-down": TrendDown,
  "trend-up": TrendUp,
  user: User,
  "user-circle-check": UserCircleCheck,
  users: Users,
  "users-three": UsersThree,
  "user-switch": UserSwitch,
  warning: Warning,
  "warning-octagon": WarningOctagon,
  wrench: Wrench,
  x: X,
} satisfies Record<string, ComponentType<IconProps>>;

export type PIconName = keyof typeof ICONS;

export interface PIconProps {
  name: PIconName;
  size?: number;
  weight?: IconWeight;
  className?: string;
  /** Token-based color (e.g. a `var(--vx-color-*)` value). */
  color?: string;
  "aria-hidden"?: boolean;
}

/** Render a Phosphor glyph by its kebab name. Decorative by default. */
export function PIcon({ name, size, weight, className, color, ...rest }: PIconProps) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return (
    <Cmp
      size={size ?? "1em"}
      weight={weight ?? "regular"}
      color={color ?? "currentColor"}
      className={className}
      aria-hidden={rest["aria-hidden"] ?? true}
    />
  );
}
