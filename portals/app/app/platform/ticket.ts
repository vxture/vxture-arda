/** Workspace-bound platform tickets. Credentials and user tokens stay server-side. */
import type { JWTPayload } from "jose";
import { getOidcConfig, type OidcConfig } from "../auth/lib/config";
import { verifyToken } from "../auth/lib/oidc";
import { assertInternalTarget } from "../lib/internal-target";

export interface PlatformContext {
  orgId: string;
  workspaceId: string;
  subject?: string;
  subjectToken?: string;
}

export function validatePlatformClaims(claims: JWTPayload, context: PlatformContext, now = Date.now() / 1000): void {
  const act = claims.act as Record<string, unknown> | undefined;
  if (!context.orgId || !context.workspaceId || claims.aud !== "vxture" || act?.sub !== "arda"
    || claims.scope !== "tool:vxture" || claims.delegated !== undefined
    || claims.org_id !== context.orgId || claims.workspace_id !== context.workspaceId
    || claims.mode !== (context.subjectToken ? "obo" : "service")
    || (context.subjectToken ? !context.subject || claims.sub !== context.subject : claims.sub !== undefined)
    || typeof claims.iat !== "number" || typeof claims.exp !== "number"
    || claims.iat > now + 30 || claims.exp <= now || claims.exp <= claims.iat || claims.exp - claims.iat > 300) {
    throw new Error("platform_ticket_scope_invalid");
  }
}

type Verify = (cfg: OidcConfig, token: string) => Promise<JWTPayload>;
export class PlatformTicketSource {
  constructor(private cfg: OidcConfig, private fetcher: typeof fetch = fetch,
    private verify: Verify = (cfg, token) => verifyToken(cfg, token, { audience: "vxture" })) {}

  async tokenFor(context: PlatformContext): Promise<string> {
    if (!context.orgId || !context.workspaceId || Boolean(context.subjectToken) !== Boolean(context.subject)) {
      throw new Error("platform_context_required");
    }
    assertInternalTarget(this.cfg.endpoints.token);
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience: "vxture",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    });
    if (context.subjectToken) {
      body.set("subject_token", context.subjectToken);
      body.set("subject_token_type", "urn:ietf:params:oauth:token-type:access_token");
    } else {
      body.set("org_id", context.orgId);
      body.set("workspace_id", context.workspaceId);
    }
    const credentials = `${encodeURIComponent(this.cfg.clientId)}:${encodeURIComponent(this.cfg.clientSecret)}`;
    const response = await this.fetcher(this.cfg.endpoints.token, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
    });
    if (!response.ok) throw new Error(`platform_exchange_${response.status}`);
    const value = await response.json() as Record<string, unknown>;
    if (value.token_type !== "Bearer" || typeof value.access_token !== "string" || !value.access_token) {
      throw new Error("platform_ticket_invalid");
    }
    validatePlatformClaims(await this.verify(this.cfg, value.access_token), context);
    return value.access_token;
  }
}

export function getPlatformTicketSource(): PlatformTicketSource {
  const cfg = getOidcConfig();
  if (!cfg) throw new Error("platform_identity_unconfigured");
  return new PlatformTicketSource(cfg);
}
