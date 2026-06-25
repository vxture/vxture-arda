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

/**
 * Returns the OIDC config when the RP is fully configured, otherwise null.
 * Until both the issuer and the client secret are provisioned, the auth routes
 * treat a null config as "not configured" (login/logout return 503, session
 * returns anonymous).
 */
export function getOidcConfig(): OidcConfig | null {
  const issuer = trimTrailingSlash((process.env.OIDC_ISSUER || "").trim());
  const clientSecret = (process.env.OIDC_CLIENT_SECRET || "").trim();
  if (!issuer || !clientSecret) return null;

  const clientId = (process.env.OIDC_CLIENT_ID || "arda").trim();
  const redirectUri = (process.env.OIDC_REDIRECT_URI || "").trim();
  const redisUrl = (process.env.REDIS_URL || "").trim();
  if (!clientId || !redirectUri || !redisUrl) return null;

  const ttl = Number.parseInt(process.env.RP_SESSION_TTL || "", 10);

  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri,
    scopes: (process.env.OIDC_SCOPES || "openid profile email phone arda").trim(),
    postLogoutRedirectUri: (process.env.OIDC_POST_LOGOUT_REDIRECT_URI || "").trim(),
    redisUrl,
    sessionTtlSeconds: Number.isFinite(ttl) && ttl > 0 ? ttl : 2592000,
    cookieName: (process.env.RP_SESSION_COOKIE_NAME || "vx_rp_session").trim(),
    // Host-only domain (no leading dot). Read verbatim from env so the cookie is
    // scoped to exactly arda.vxture.com and never to sibling *.vxture.com hosts.
    cookieDomain: (process.env.RP_SESSION_COOKIE_DOMAIN || "").trim(),
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
