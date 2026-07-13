"use client";

import { Button, EmptyState, Icon } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { minTierFor, type FeatureKey } from "./capability";
import { consoleDeepLink } from "./deeplink";
import { PLAN_TAGS } from "../ui/nav-config";

/**
 * Minimal upgrade interstitial (owner ruling 2026-07-13): rendered in place of
 * a locked screen's content. States the feature and its required tier, with a
 * single explicit subscribe button deep-linking to the console. Deliberately
 * no auto-redirect and no plan/price details - those are console-owned.
 */
export function UpgradePanel({ screenKey, featureKey }: { screenKey: string; featureKey: FeatureKey }) {
  const tn = useTranslations("nav");
  const t = useTranslations("upgradePanel");
  const tier = minTierFor(featureKey);
  const tierTag = tier ? (PLAN_TAGS[tier] ?? tier.toUpperCase()) : "";

  return (
    <div className="entitlement-pending">
      <EmptyState
        title={t("title", { feature: tn(screenKey), tier: tierTag })}
        description={t("description")}
        action={
          <Button asChild variant="default">
            <a
              href={consoleDeepLink({ intent: "upgrade", targetTier: tier })}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="sparkles" size="sm" />
              {t("cta")}
            </a>
          </Button>
        }
      />
    </div>
  );
}
