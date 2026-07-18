import type { ReactNode } from "react";

// Data-build (self-owned data ingestion into storage) board. Placeholder-only
// this round - no gating layer yet; add a ScreenGate + capability key when the
// first real screen ships (arda-biz-107, "key first, then domain").
export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
