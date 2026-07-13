/**
 * OIDC RP configuration for the arda app (Vxture App Integration Standard
 * v1.0). All values come from server-side env; nothing here is exposed to the
 * browser. Endpoint paths are the frozen contract relative to the issuer
 * (standard section 2), so we derive them rather than fetch discovery per call.
 *
 * arda runs on a SINGLE host (arda.vxture.com / beta-arda.vxture.com) and the
 * OIDC callback lives on that same host (/auth/callback), so there is no
 * cross-subdomain apex hop. The session cookie is host-only (no leading dot)
 * so it cannot leak to sibling vxture subdomains.
 */

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  // Public origin of this app (scheme + host + port), derived from redirectUri.
  // User-facing redirects (callback landing, logout home, returnTo base) anchor
  // to this instead of the request host: behind the shared edge proxy the
  // request host resolves to the internal bind (0.0.0.0:3230), which would
  // otherwise leak into Location headers (e.g. https://0.0.0.0:3230/?sso=...).
  appOrigin: string;
  scopes: string;
  postLogoutRedirectUri: string;
  redisUrl: string;
  sessionTtlSeconds: number;
  cookieName: string;
  cookieDomain: string;
  isProd: boolean;
  endpoints: {
    authorize: string;
    token: string;
    jwks: string;
    endSession: string;
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Origin (scheme + host + port) of an absolute URL, or "" if it is malformed. */
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/**
 * Returns the OIDC config when the RP is fully configured, otherwise null.
 * Until both the issuer and the client secret are provisioned, the auth routes
 * treat a null config as "not configured" (login/logout return 503, session
 * returns anonymous).
 *
 * When MOCK_AUTH=true (local dev, no real IdP) only REDIS_URL is required.
 * OIDC endpoints are filled with unreachable placeholders; the /auth/dev-login
 * route creates sessions directly in Redis so those endpoints are never called.
 * MOCK_AUTH must never be set in production (NODE_ENV=production ignores it).
 */
export function getOidcConfig(): OidcConfig | null {
  const redisUrl = (process.env.REDIS_URL || "").trim();
  const cookieName = (process.env.RP_SESSION_COOKIE_NAME || "vx_rp_session").trim();
  const cookieDomain = (process.env.RP_SESSION_COOKIE_DOMAIN || "").trim();
  const ttlRaw = Number.parseInt(process.env.RP_SESSION_TTL || "", 10);
  const sessionTtlSeconds = Number.isFinite(ttlRaw) && ttlRaw > 0 ? ttlRaw : 2592000;

  if (process.env.MOCK_AUTH === "true" && process.env.NODE_ENV !== "production") {
    if (!redisUrl) return null;
    return {
      issuer: "http://mock-idp.local",
      clientId: "arda",
      clientSecret: "mock-secret",
      redirectUri: "http://localhost:3230/auth/callback",
      appOrigin: "http://localhost:3230",
      scopes: "openid profile email phone",
      postLogoutRedirectUri: "http://localhost:3230/",
      redisUrl,
      sessionTtlSeconds: Math.min(sessionTtlSeconds, 86400),
      cookieName,
      cookieDomain,
      isProd: false,
      endpoints: {
        authorize: "http://mock-idp.local/oidc/authorize",
        token: "http://mock-idp.local/oidc/token",
        jwks: "http://mock-idp.local/oidc/jwks",
        endSession: "http://mock-idp.local/oidc/end_session",
      },
    };
  }

  const issuer = trimTrailingSlash((process.env.OIDC_ISSUER || "").trim());
  const clientSecret = (process.env.OIDC_CLIENT_SECRET || "").trim();
  if (!issuer || !clientSecret) return null;

  const clientId = (process.env.OIDC_CLIENT_ID || "arda").trim();
  const redirectUri = (process.env.OIDC_REDIRECT_URI || "").trim();
  if (!clientId || !redirectUri || !redisUrl) return null;
  // redirectUri is the registered, public callback URL; its origin is the
  // authoritative public origin of this app. A malformed redirectUri leaves the
  // RP unconfigured rather than silently falling back to the request host.
  const appOrigin = originOf(redirectUri);
  if (!appOrigin) return null;

  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    appOrigin,
    scopes: (process.env.OIDC_SCOPES || "openid profile email phone").trim(),
    postLogoutRedirectUri: (process.env.OIDC_POST_LOGOUT_REDIRECT_URI || "").trim(),
    redisUrl,
    sessionTtlSeconds,
    cookieName,
    // Host-only domain (no leading dot). Read verbatim from env so the cookie is
    // scoped to exactly arda.vxture.com and never to sibling *.vxture.com hosts.
    cookieDomain,
    isProd: process.env.NODE_ENV === "production",
    endpoints: {
      authorize: `${issuer}/oidc/authorize`,
      token: `${issuer}/oidc/token`,
      jwks: `${issuer}/oidc/jwks`,
      endSession: `${issuer}/oidc/end_session`,
    },
  };
}

/** True when the OIDC RP is configured and the auth endpoints should be live. */
export function oidcConfigured(): boolean {
  return getOidcConfig() !== null;
}
