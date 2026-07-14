import type { ReactNode } from "react";
import { PIcon, type PIconName } from "./phosphor-icon";

/**
 * Icon + title + description heading, reused for both the page-level header
 * and each content-area section header - the same pattern vxture admin's own
 * home page uses (`OverviewHeading` in `app/(admin)/page.tsx`, one component
 * for both `level="page"` and section headings), not DS's `<PageHeader>`
 * (its `icon` slot has no CSS backing in the installed DS range) and not the
 * unused shell-template `.tpl-head` mockup.
 */
export function SectionHeading({
  icon,
  title,
  description,
  level = "section",
  action,
}: {
  icon: PIconName;
  title: string;
  description: string;
  level?: "page" | "section";
  action?: ReactNode;
}) {
  const Title = level === "page" ? "h1" : "h2";
  return (
    <div className={"ov-heading" + (level === "page" ? " is-page" : "")}>
      <PIcon className="ov-heading-ico" name={icon} weight="fill" />
      <div className="ov-heading-copy">
        <Title>{title}</Title>
        <p>{description}</p>
      </div>
      {action && <div className="ov-heading-action">{action}</div>}
    </div>
  );
}
