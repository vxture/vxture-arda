import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Funnel_Display } from "next/font/google";
import { preferenceBootstrapScript } from "@arda/shared/preferences";
import "@vxture/design-system/styles/globals.css";
import "@vxture/design-system/styles/brands/vxture.css";
import "./globals.css";
import { Providers } from "@arda/shared/providers";
import { I18nProvider } from "@arda/shared/i18n";
import { messages } from "../messages";
import { AccountGate } from "./ui/account-gate";
import { EntitlementGate } from "./entitlement/gate";

/** DS brand typeface (Funnel Display) wired to the DS brand-font loader slot. */
const brandFont = Funnel_Display({
  subsets: ["latin"],
  variable: "--vx-font-loader-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arda",
  description: "Arda data assets workspace",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className={brandFont.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceBootstrapScript }} />
      </head>
      <body>
        <Providers>
          <I18nProvider messages={messages}>
            {/* Entry gating: AccountGate authenticates the user (OIDC RP
                session), then EntitlementGate checks the workspace
                subscription before any app surface renders. */}
            <AccountGate>
              <EntitlementGate>{children}</EntitlementGate>
            </AccountGate>
          </I18nProvider>
        </Providers>
      </body>
    </html>
  );
}
