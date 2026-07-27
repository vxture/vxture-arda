// S2S token-exchange caller for arda Curator -> Atlas (ADR-013 / arda-biz-270).
// Mirrors vxture-karda's kb/retrieval/atlas-token.ts pattern: to call Atlas,
// arda needs an aud=atlas RS256 bearer. arda mints it from the platform IdP -
// NOT from Atlas - using arda's own confidential OIDC client (the same client
// C1 uses), so this depends only on the platform's token endpoint, not on
// Atlas being reachable.
//
// grant_type = token-exchange (RFC 8693), client auth = arda's existing OIDC
// client, aud = the callee product_code ("atlas"). Curator calls are made in
// service mode on behalf of arda's own signed-in user (no subject_token at
// this boundary): an explicit org/workspace context is declared and the
// platform validates coverage when minting. Tokens are short-lived and cached
// per (org, ws) with a refresh margin.
import { getOidcConfig } from "../auth/lib/config";

export interface AtlasTokenConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  audience: string; // callee product_code, e.g. "atlas"
}

export interface TokenContext {
  org: string;
  ws: string;
}

export interface AtlasTokenSource {
  tokenFor(ctx: TokenContext): Promise<string>;
}

type FetchLike = typeof fetch;

const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
/** Re-mint this many ms before the token's stated expiry (clock skew + latency). */
const REFRESH_MARGIN_MS = 30_000;

interface Cached {
  token: string;
  expiresAt: number;
}

export class Rfc8693TokenSource implements AtlasTokenSource {
  private cache = new Map<string, Cached>();

  constructor(
    private cfg: AtlasTokenConfig,
    private fetchImpl: FetchLike = fetch,
    private now: () => number = () => Date.now(),
  ) {}

  async tokenFor(ctx: TokenContext): Promise<string> {
    const key = `${ctx.org}|${ctx.ws}`;
    const hit = this.cache.get(key);
    if (hit && this.now() < hit.expiresAt) return hit.token;

    const minted = await this.mint(ctx);
    const ttlMs = Math.max(0, (minted.expiresIn ?? 300) * 1000 - REFRESH_MARGIN_MS);
    this.cache.set(key, { token: minted.accessToken, expiresAt: this.now() + ttlMs });
    return minted.accessToken;
  }

  private async mint(ctx: TokenContext): Promise<{ accessToken: string; expiresIn?: number }> {
    const body = new URLSearchParams({
      grant_type: TOKEN_EXCHANGE_GRANT,
      audience: this.cfg.audience,
      org_id: ctx.org,
      workspace_id: ctx.ws,
      client_id: this.cfg.clientId,
      client_secret: this.cfg.clientSecret,
    });
    const url = `${this.cfg.issuer.replace(/\/$/, "")}/oidc/token`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`token-exchange ${res.status}`);
    const j: unknown = await res.json().catch(() => null);
    const o = (j ?? {}) as Record<string, unknown>;
    if (typeof o.access_token !== "string") throw new Error("token-exchange: no access_token in response");
    return { accessToken: o.access_token, expiresIn: typeof o.expires_in === "number" ? o.expires_in : undefined };
  }
}

/**
 * The Atlas token source, or null when arda has no client credentials to mint
 * with. Reuses the OIDC config (issuer + client id/secret = arda's
 * confidential client, the same one C1 uses); the audience defaults to
 * "atlas".
 */
export function getAtlasTokenSource(): AtlasTokenSource | null {
  const oidc = getOidcConfig();
  if (!oidc || !oidc.issuer || !oidc.clientId || !oidc.clientSecret) return null;
  return new Rfc8693TokenSource({
    issuer: oidc.issuer,
    clientId: oidc.clientId,
    clientSecret: oidc.clientSecret,
    audience: process.env.ATLAS_AUDIENCE ?? "atlas",
  });
}
