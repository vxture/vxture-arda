"use client";

import { EmptyState, Icon } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { type PIconName } from "./phosphor-icon";
import { SectionHeading } from "./section-heading";

// Shared "under construction" surface for sections that are not built yet.
export function PlaceholderSection() {
  const t = useTranslations("placeholder");
  return (
    <div className="app-section">
      <EmptyState
        title={
          <span className="app-empty-title">
            <Icon name="cube" size="sm" />
            {t("title")}
          </span>
        }
        description={t("description")}
      />
    </div>
  );
}

/** Screen-level placeholder for planned menu items (arda-biz-106 L2 menu
 *  skeleton): the item's own page heading plus the shared under-construction
 *  empty state. Replaces the round-1 domain-level DomainRoadmap chips - the
 *  roadmap now IS the menu, every planned item is a navigable entry. */
export function UnderConstruction({ screenKey, icon }: { screenKey: string; icon: PIconName }) {
  const tn = useTranslations("nav");
  const tp = useTranslations("placeholder");

  return (
    <div className="screen">
      <SectionHeading level="page" icon={icon} title={tn(screenKey)} description={tp("pending")} />
      <PlaceholderSection />
    </div>
  );
}
