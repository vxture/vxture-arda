/** Curator -> Atlas service tickets, verified before they leave Arda. */
import type { JWTPayload } from "jose";
import { getOidcConfig, type OidcConfig } from "../auth/lib/config";
import { verifyToken } from "../auth/lib/oidc";
import { PlatformTicketSource } from "../platform/ticket";

export interface TokenContext { org: string; ws: string }
export interface AtlasTokenSource { tokenFor(ctx: TokenContext): Promise<string> }

export class Rfc8693TokenSource implements AtlasTokenSource {
  private source: PlatformTicketSource;
  constructor(cfg: OidcConfig, fetcher: typeof fetch = fetch,
    verify: (cfg: OidcConfig, token: string) => Promise<JWTPayload> =
      (config, token) => verifyToken(config, token, { audience: "atlas" })) {
    this.source = new PlatformTicketSource(cfg, fetcher, verify, "atlas");
  }
  async tokenFor(ctx: TokenContext): Promise<string> {
    // Basic client auth, internal exchange, public issuer/JWKS authority,
    // exact audience/actor/org/workspace/mode/scope and <=300s signed lifetime.
    return this.source.tokenFor({ orgId: ctx.org, workspaceId: ctx.ws });
  }
}

export function getAtlasTokenSource(): AtlasTokenSource | null {
  const cfg = getOidcConfig();
  if (!cfg) return null;
  if (process.env.ATLAS_AUDIENCE && process.env.ATLAS_AUDIENCE !== "atlas") {
    throw new Error("atlas_audience_invalid");
  }
  return new Rfc8693TokenSource(cfg);
}
