"use client";

import { EmptyState, Icon } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";

// Shared "under construction" surface for sections that are not built yet.
// Only data-assets/overview is a real surface; every other section renders this.
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
