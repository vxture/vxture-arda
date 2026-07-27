import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Funnel_Display } from "next/font/google";
import { preferenceBootstrapScript } from "@arda/shared/preferences";
import "@vxture/design-system/styles/globals.css";
import "@vxture/design-system/styles/brands/vxture.css";
import "@vxture/design-system/styles/shell-template.css";
import "./globals.css";
import { Providers } from "@arda/shared/providers";
import { I18nProvider } from "@arda/shared/i18n";
import { messages } from "../messages";

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
          {/* Entry gating (AccountGate + EntitlementGate) lives in the (app)
              group layout, not here: the (demo) group (status,
              entitlement-matrix) is intentionally public. */}
          <I18nProvider messages={messages}>{children}</I18nProvider>
        </Providers>
      </body>
    </html>
  );
}
