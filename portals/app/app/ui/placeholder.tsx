"use client";

import { EmptyState, Icon } from "@vxture/design-system";
import { useTranslations } from "@arda/shared/i18n";
import { PIcon, type PIconName } from "./phosphor-icon";
import { SectionHeading } from "./section-heading";
import { DOMAIN_ROADMAP } from "./nav-config";

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

/** Domain shell for L1 domains without a shipped screen yet (round-1
 *  placeholder, arda-biz-105 SS3): the domain's own header plus its L2
 *  capability roadmap as "coming soon" chips, so the full information
 *  architecture is demoable now - capabilities land into it by priority. */
export function DomainRoadmap({ domainId, icon }: { domainId: string; icon: PIconName }) {
  const tb = useTranslations("board");
  const tr = useTranslations("domainRoadmap");
  const tp = useTranslations("placeholder");
  const items = DOMAIN_ROADMAP[domainId] ?? [];

  return (
    <div className="screen">
      <SectionHeading level="page" icon={icon} title={tb(domainId)} description={tb(domainId + "Desc")} />
      <div className="app-section">
        <EmptyState
          title={
            <span className="app-empty-title">
              <Icon name="cube" size="sm" />
              {tp("title")}
            </span>
          }
          description={tp("description")}
        />
        {items.length > 0 && (
          <div className="tag-list" style={{ marginTop: "var(--vx-space-md)" }}>
            {items.map((key) => (
              <span className="tag" key={key}>
                <PIcon name="clock" />
                {tr(domainId + "." + key)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
