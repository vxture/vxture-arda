/**
 * Allowlist for the post-login landing URL. arda is a single host, so we permit
 * only the configured public app host (the origin of redirectUri, which equals
 * arda.ruyin.work / beta-arda.vxture.com / dev localhost) and the configured
 * cookie host. No subdomain wildcard: we deliberately do NOT accept sibling
 * *.vxture.com hosts. Anything else is rejected to prevent an open redirect.
 *
 * Relative returnTo values resolve against the canonical app origin, never the
 * request host: behind the edge proxy the request host is the internal bind
 * (0.0.0.0:3230), so resolving against it would store/redirect to that host.
 */
import type { NextRequest } from "next/server";
import type { OidcConfig } from "./config";

export function safeReturnTo(raw: string | null, _request: NextRequest, cfg: OidcConfig): string {
  if (!raw) return "";
  let url: URL;
  try {
    url = new URL(raw, cfg.appOrigin);
  } catch {
    return "";
  }
  if (url.protocol !== "https:" && cfg.isProd) return "";
  // Host-only allowlist: the canonical app host or the configured cookie host.
  const appHost = cfg.cookieDomain.replace(/^\./, "").trim();
  const host = url.hostname;
  let canonicalHost = "";
  try {
    canonicalHost = new URL(cfg.appOrigin).hostname;
  } catch {
    canonicalHost = "";
  }
  if (canonicalHost && host === canonicalHost) return url.toString();
  if (appHost && host === appHost) return url.toString();
  return "";
}
