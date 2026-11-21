/** Separate product-wide read grant; never reuse a workspace write ticket. */
import type { JWTPayload } from "jose";
import { getOidcConfig, type OidcConfig } from "../auth/lib/config";
import { verifyToken } from "../auth/lib/oidc";
import { assertInternalTarget } from "../lib/internal-target";

export function validateProvisioningReadClaims(claims: JWTPayload, now = Date.now() / 1000): void {
  const act = claims.act as Record<string, unknown> | undefined;
  if (claims.aud !== "vxture" || act?.sub !== "arda" || Object.keys(act).length !== 1
    || claims.scope !== "provisioning:read" || claims.mode !== "service"
    || ["sub", "workspace_id", "org_id", "tenant_id", "delegated"].some(key => key in claims)
    || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)
    || claims.iat! > now + 30 || claims.exp! <= now || claims.exp! <= claims.iat!
    || claims.exp! - claims.iat! > 300) throw new Error("provisioning_read_ticket_invalid");
}

export class ProvisioningReadClient {
  private bearer?: string;
  private expiresAt = 0;
  constructor(private cfg: OidcConfig, private base: string,
    private fetcher: typeof fetch = fetch,
    private verify = (cfg: OidcConfig, token: string) => verifyToken(cfg, token, { audience: "vxture" })) {}

  private async token(): Promise<string> {
    if (this.bearer && this.expiresAt > Date.now() / 1000 + 10) return this.bearer;
    assertInternalTarget(this.cfg.endpoints.token);
    const credentials = `${encodeURIComponent(this.cfg.clientId)}:${encodeURIComponent(this.cfg.clientSecret)}`;
    const response = await this.fetcher(this.cfg.endpoints.token, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        audience: "vxture", scope: "provisioning:read" }).toString(),
    });
    if (!response.ok) throw new Error(`provisioning_read_exchange_${response.status}`);
    const value = await response.json();
    if (value?.token_type !== "Bearer" || typeof value.access_token !== "string" || !value.access_token) {
      throw new Error("provisioning_read_token_invalid");
    }
    const claims = await this.verify(this.cfg, value.access_token);
    validateProvisioningReadClaims(claims);
    this.bearer = value.access_token;
    this.expiresAt = claims.exp!;
    return this.bearer!;
  }

  async page(cursor?: string): Promise<unknown> {
    assertInternalTarget(this.base);
    const query = new URLSearchParams({ limit: "200" });
    if (cursor) query.set("cursor", cursor);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.fetcher(`${this.base.replace(/\/+$/, "")}/platform/provisioning?${query}`, {
        headers: { Authorization: `Bearer ${await this.token()}`, Accept: "application/json" },
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000),
      });
      if (response.status === 401 && attempt === 0) {
        await response.body?.cancel();
        this.bearer = undefined;
        continue;
      }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`provisioning_read_${response.status}`); }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("provisioning_read_empty");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 1_048_576) throw new Error("provisioning_read_budget");
          chunks.push(value);
        }
      } finally { await reader.cancel(); reader.releaseLock(); }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    }
    throw new Error("provisioning_read_unauthorized");
  }
}

export function getProvisioningReadClient(): ProvisioningReadClient {
  const cfg = getOidcConfig();
  const base = process.env.PLATFORM_API_URL;
  if (!cfg || !base) throw new Error("provisioning_read_unconfigured");
  return new ProvisioningReadClient(cfg, base);
}
