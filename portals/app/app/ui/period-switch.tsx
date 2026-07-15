"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "@arda/shared/i18n";

const PERIODS = ["month", "quarter", "year", "all"] as const;
export type PeriodKey = (typeof PERIODS)[number];

/**
 * Segmented period control (本月/本季度/本年度/全部), matching the vxture
 * admin home page's real `PeriodSwitch` pattern (icon-free segmented tabs,
 * one independent control per section). Drives a `searchParams` key so the
 * server component re-fetches period-scoped data - no client-side faking.
 *
 * `scope="main"` (the one core-metrics control): clicking it clears every
 * other period param, so every section that hasn't been individually
 * overridden snaps back to following it - "click the overall switch, all of
 * them follow."
 * `scope="sub"` (each data-aggregation sub-block): clicking it only ever
 * touches its own param, carrying every other *raw* URL param through
 * unchanged - "click one sub-block, only that block changes."
 *
 * Takes `rawParams` (only the keys actually present in the URL, not the
 * server-resolved/defaulted values) so a sub click never accidentally
 * freezes a param the user never touched, and a main click can cleanly wipe
 * everything without needing to know what the other controls resolved to.
 */
export function PeriodSwitch({
  paramKey,
  value,
  scope,
  rawParams,
}: {
  paramKey: string;
  value: PeriodKey;
  scope: "main" | "sub";
  rawParams: Record<string, string | undefined>;
}) {
  const t = useTranslations("dashboard.period");
  const router = useRouter();

  const setPeriod = (next: PeriodKey) => {
    // scroll:false - router.push scrolls to the top of the page by default
    // on navigation; without this, switching a sub-block's period (or even
    // the main one, mid-scroll) yanks the viewport back up to the page
    // title instead of staying put while the section refreshes in place.
    if (scope === "main") {
      router.push("?" + paramKey + "=" + next, { scroll: false });
      return;
    }
    const params = new URLSearchParams();
    for (const [key, v] of Object.entries(rawParams)) {
      if (v) params.set(key, v);
    }
    params.set(paramKey, next);
    router.push("?" + params.toString(), { scroll: false });
  };

  return (
    <div className="seg-tabs period-switch" role="tablist" aria-label={t("label")}>
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          role="tab"
          aria-selected={value === p}
          className={"seg" + (value === p ? " active" : "")}
          onClick={() => setPeriod(p)}
        >
          {t(p)}
        </button>
      ))}
    </div>
  );
}
