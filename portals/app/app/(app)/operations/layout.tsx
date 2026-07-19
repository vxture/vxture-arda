import type { ReactNode } from "react";

// Pass-through: the operations board is now partially real (capacity profile,
// biz-107 / Wave A). Placeholder sub-pages still render UnderConstruction on
// their own; real sub-screens gate themselves. No blanket future gate here -
// that would hide the shipped capacity screen behind "coming soon".
export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
