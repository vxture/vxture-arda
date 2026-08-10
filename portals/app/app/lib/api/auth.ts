import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../db";
import { getWipeState } from "../workspace-state";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { hasDataAccess } from "../../entitlement/types";
import { problem } from "./problem";
import { checkRateLimit } from "./rate-limit";
import type { ApiScope } from "./scopes";

/**
 * Authentication + gating chain for every /api/v1 request (data-170 1.2/2):
 *
 *   1. x-arda-api-key -> sha256 lookup, revoked rejected     (401)
 *   2. per-key rate limit                                    (429)
 *   3. required scope present on the key (fail-closed)       (403)
 *   4. workspace wipe chokepoint (Lc-BL3)                    (410)
 *   5. entitlement: data access = standalone OR bundled      (403)
 *
 * Workspace scope always comes from the KEY, never from the caller. The
 * entitlement resolver is stale-on-error and degrades to "no entitlement",
 * so step 5 is fail-closed by construction.
 */

export interface ApiContext {
  workspaceId: string;
  /** ApiKey row id, or null for the S2S bearer plane. */
  apiKeyId: string | null;
  /** Consumer agent identity for audit/policy (data-170 3.2); null = unset. */
  consumerApp: string | null;
  /** AuditLog.actor string for this caller ("apikey:<consumerApp|name>"). */
  actor: string;
}

const LAST_USED_UPDATE_INTERVAL_MS = 60_000;

export async function authenticateApiRequest(
  req: NextRequest,
  requiredScope: ApiScope,
): Promise<ApiContext | NextResponse> {
  // S2S bearer plane (token exchange, platform#226): verified identity from
  // the platform IdP + arda's own act.sub allow-list. Operation authz is
  // arda's model (D3): an allow-listed caller gets the full /api/v1 surface
  // in v1, so requiredScope is satisfied by admission. Same gating tail as
  // the key plane: rate limit -> wipe -> entitlement.
  const authz = req.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) {
    const { verifyS2sBearer } = await import("./bearer");
    const v = await verifyS2sBearer(authz.slice(7));
    if (!v.ok) {
      return problem(v.code === "invalid_token" ? 401 : 403, v.code);
    }
    const rate = await checkRateLimit(`s2s:${v.id.actSub}:${v.id.workspaceId}`);
    if (!rate.allowed) {
      return problem(429, "rate_limited", undefined, undefined, {
        "retry-after": String(rate.retryAfterSeconds),
        "ratelimit-limit": String(rate.limit),
        "ratelimit-remaining": String(rate.remaining),
      });
    }
    const wiped = await getWipeState(v.id.workspaceId);
    if (wiped.wiped) return problem(410, "workspace_wiped");
    const sub = await getEntitlementResolver().resolve(null, v.id.workspaceId);
    if (!hasDataAccess(sub)) {
      return problem(403, "entitlement_required", "The workspace has no active arda entitlement (standalone or bundled).");
    }
    return {
      workspaceId: v.id.workspaceId,
      apiKeyId: null,
      consumerApp: v.id.actSub,
      actor: v.id.sub ? `s2s:${v.id.actSub}:${v.id.sub}` : `s2s:${v.id.actSub}`,
    };
  }

  const rawKey = req.headers.get("x-arda-api-key");
  if (!rawKey) return problem(401, "missing_api_key", "Provide the API key in the x-arda-api-key header.");

  const hashedKey = createHash("sha256").update(rawKey).digest("hex");
  const key = await prisma.apiKey.findUnique({ where: { hashedKey } });
  if (!key || key.revoked) return problem(401, "invalid_api_key");

  const rate = await checkRateLimit(key.id);
  if (!rate.allowed) {
    return problem(429, "rate_limited", undefined, undefined, {
      "retry-after": String(rate.retryAfterSeconds),
      "ratelimit-limit": String(rate.limit),
      "ratelimit-remaining": String(rate.remaining),
    });
  }

  if (!key.scopes.includes(requiredScope)) {
    return problem(403, "insufficient_scope", `This endpoint requires the '${requiredScope}' scope.`);
  }

  const wipe = await getWipeState(key.workspaceId);
  if (wipe.wiped) return problem(410, "workspace_wiped");

  const subscription = await getEntitlementResolver().resolve(null, key.workspaceId);
  if (!hasDataAccess(subscription)) {
    return problem(403, "entitlement_required", "The workspace has no active arda entitlement (standalone or bundled).");
  }

  // Liveness marker, throttled to one write per key per interval; best-effort.
  const now = Date.now();
  if (!key.lastUsedAt || now - key.lastUsedAt.getTime() > LAST_USED_UPDATE_INTERVAL_MS) {
    prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date(now) } })
      .catch(() => {});
  }

  return {
    workspaceId: key.workspaceId,
    apiKeyId: key.id,
    consumerApp: key.consumerApp,
    actor: `apikey:${key.consumerApp ?? key.name}`,
  };
}

/** Type guard: narrows the auth result to the error-response branch. */
export function isErrorResponse(result: ApiContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
