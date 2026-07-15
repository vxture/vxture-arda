import type { ReactNode } from "react";
import { ScreenGate } from "../../entitlement/screen-gate";

export default function Layout({ children }: { children: ReactNode }) {
  return <ScreenGate screen="masterdata">{children}</ScreenGate>;
}
