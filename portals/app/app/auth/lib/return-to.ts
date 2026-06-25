/**
 * Allowlist for the post-login landing URL. arda is a single host, so we permit
 * only the request's own host (covers prod arda.vxture.com, beta, and dev
 * localhost) and the configured app host (cookieDomain). No subdomain wildcard:
 * we deliberately do NOT accept sibling *.vxture.com hosts. Anything else is
 * rejected to prevent an open redirect.
 */
import type { NextRequest } from "next/server";
import type { OidcConfig } from "./config";

export function safeReturnTo(raw: string | null, request: NextRequest, cfg: OidcConfig): string {
  if (!raw) return "";
  let url: URL;
  try {
    url = new URL(raw, request.nextUrl.origin);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && cfg.isProd) return "";
  // Host-only allowlist: the request host (self) or the configured app host.
  const appHost = cfg.cookieDomain.replace(/^\./, "").trim();
  const host = url.hostname;
  if (host === request.nextUrl.hostname) return url.toString();
  if (appHost && host === appHost) return url.toString();
  return "";
}
