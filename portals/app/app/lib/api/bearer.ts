import { createRemoteJWKSet, jwtVerify } from "jose";
import { getOidcConfig, type OidcConfig } from "../../auth/lib/config";

/**
 * S2S bearer verification for /api/v1 (platform token exchange, product_210
 * section 3; rollout via vxture-platform#226).
 *
 * Verification obligations (section 3.3) plus arda's own gate:
 *   - RS256 only, kid lookup against the SAME issuer JWKS the RP uses
 *   - iss / aud (S2S_AUDIENCE, default "arda") / exp
 *   - act.sub ALLOW-LIST (S2S_ALLOWED_CALLERS): any authenticated platform
 *     client can mint aud=arda - a valid signature is NOT an authorised
 *     caller. Empty allow-list = bearer path disabled (fail closed).
 *
 * Scope is product-level (`tool:arda`, decision D3) and deliberately NOT
 * consulted for operation authz: the token answers who is calling on whose
 * behalf; what they may do is arda's own model (v1: an allow-listed caller
 * gets the full /api/v1 surface; finer per-caller grants live here later).
 * Tokens are 300s and non-refreshable - callers re-exchange (D1).
 */

export interface S2sIdentity {
  /** Original user subject - OBO mode only; null in service mode. */
  sub: string | null;
  /** Calling product code (act.sub), e.g. "runos". */
  actSub: string;
  workspaceId: string;
  orgId: string;
  mode: "obo" | "service";
}

const JWKS_TIMEOUT_MS = 5000;
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(cfg: OidcConfig) {
  let jwks = jwksCache.get(cfg.endpoints.jwks);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(cfg.endpoints.jwks), { timeoutDuration: JWKS_TIMEOUT_MS });
    jwksCache.set(cfg.endpoints.jwks, jwks);
  }
  return jwks;
}

export function allowedCallers(env: string | undefined = process.env.S2S_ALLOWED_CALLERS): Set<string> {
  return new Set(
    (env ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export type S2sResult = { ok: true; id: S2sIdentity } | { ok: false; code: string };

export async function verifyS2sBearer(token: string): Promise<S2sResult> {
  const callers = allowedCallers();
  if (callers.size === 0) return { ok: false, code: "s2s_disabled" };
  const cfg = getOidcConfig();
  if (!cfg) return { ok: false, code: "s2s_disabled" };

  const audience = (process.env.S2S_AUDIENCE || "arda").trim();
  try {
    const { payload } = await jwtVerify(token, getJwks(cfg), {
      algorithms: ["RS256"],
      issuer: cfg.issuer,
      audience,
      clockTolerance: 60,
    });
    const actSub = typeof (payload.act as { sub?: unknown })?.sub === "string" ? (payload.act as { sub: string }).sub : "";
    const workspaceId = typeof payload.workspace_id === "string" ? payload.workspace_id : "";
    const mode = payload.mode === "obo" ? "obo" : payload.mode === "service" ? "service" : null;
    if (!actSub || !workspaceId || !mode) return { ok: false, code: "invalid_token" };
    if (!callers.has(actSub)) return { ok: false, code: "caller_not_allowed" };
    return {
      ok: true,
      id: {
        sub: typeof payload.sub === "string" && payload.sub ? payload.sub : null,
        actSub,
        workspaceId,
        orgId: typeof payload.org_id === "string" ? payload.org_id : "",
        mode,
      },
    };
  } catch {
    return { ok: false, code: "invalid_token" };
  }
}
