/**
 * Console deep-link builder (ent-120 §4a, reply-06 §2).
 *
 * The ONLY conversion exit from the product: a link into the vxture console
 * where all commercial decisions (trial eligibility, plans, prices, add-ons)
 * are rendered. The product never infers or displays those. Links fire ONLY
 * on an explicit user click - never auto-redirect (owner ruling 2026-07-13).
 *
 * Intent vocabulary is deliberately tiny: upgrade | renew | addon. The console
 * tolerates unknown intents by degrading to its subscription home page, so a
 * stale link costs one navigation, never a product logic error.
 */

import type { Tier } from "./types";

const CONSOLE_BASE = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.vxture.com";

/** `seat` is reserved (arda_303 §2.3): per-product seat purchase, co-terms
 *  with the product's main subscription. The console tolerates it as unknown
 *  until implemented, so emitting it early is safe. */
export type ConsoleIntent = "upgrade" | "renew" | "addon" | "seat";

export function consoleDeepLink(opts: {
  intent: ConsoleIntent;
  /** Product-known upgrade target (minTierFor); the console prices it. */
  targetTier?: Tier | null;
  /** For intent=addon: which metric ran out (e.g. "ai.credit"). */
  metric?: string;
}): string {
  const params = new URLSearchParams({ product: "arda", intent: opts.intent });
  if (opts.targetTier) params.set("target_tier", opts.targetTier);
  if (opts.metric) params.set("metric", opts.metric);
  return `${CONSOLE_BASE}/subscribe?${params.toString()}`;
}
