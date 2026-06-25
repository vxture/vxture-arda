/**
 * Canonical Arda brand metadata shared across the Arda app. The app's local
 * lib/brand can spread `ardaBrandCore` and layer on surface-specific fields.
 *
 * Arda is a Vxture sub-brand. This path is contract-scanned (ASCII-only): the
 * copyright glyph is built from its code point, and any localized (CJK) brand
 * strings stay in ASCII-exempt message JSON or JSX.
 */

/** Absolute URL to the Arda symbol PNG for the given resolved theme. */
export function markSrc(resolved: string): string {
  return resolved === "dark"
    ? "/assets/brand/arda-symbol-dark.png"
    : "/assets/brand/arda-symbol-light.png";
}

/** Copyright glyph (U+00A9) built from its code point so this ASCII-scanned
 *  source stays ASCII while the rendered footer shows the literal symbol. */
const COPYRIGHT = String.fromCharCode(0xa9);

export const ardaBrandCore = {
  /** Default product wordmark. */
  productName: "Arda",
  productDomain: "arda.vxture.com",
  /** Parent studio masterbrand. */
  studioName: "Vxture",
  studioUrl: "https://vxture.com",
  /** Public marketing / canonical product front door. */
  siteUrl: "https://arda.vxture.com",
  copyright: `${COPYRIGHT} 2026 Vxture. All rights reserved.`,
  legalLinks: [
    ["Terms of Service", "https://vxture.com/legal/terms"],
    ["Privacy Policy", "https://vxture.com/legal/privacy"],
  ],
} as const;
