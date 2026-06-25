import type { ReactNode } from "react";
import { Shell } from "../ui/shell";

// Section group layout: every page under (app) renders inside the DS shell
// (header + left section nav + footer). Auth + entitlement gating happen above
// this, in the root layout.
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
