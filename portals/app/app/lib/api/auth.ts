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
  apiKeyId: string;
  /** Consumer agent identity for audit/policy (data-170 3.2); null = unset. */
  consumerApp: string | null;
}

const LAST_USED_UPDATE_INTERVAL_MS = 60_000;

export async function authenticateApiRequest(
  req: NextRequest,
  requiredScope: ApiScope,
): Promise<ApiContext | NextResponse> {
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

  return { workspaceId: key.workspaceId, apiKeyId: key.id, consumerApp: key.consumerApp };
}

/** Type guard: narrows the auth result to the error-response branch. */
export function isErrorResponse(result: ApiContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
