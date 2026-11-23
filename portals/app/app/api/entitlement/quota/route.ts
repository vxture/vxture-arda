/**
 * GET /api/entitlement/quota
 *
 * Returns the current workspace's full quota picture sourced from the platform
 * C2 entitlement endpoint (limits + quota_pools, ent-120 v2). Used by the
 * admin UI to display storage remaining, api.call remaining, etc.
 *
 * Shares the same 45-second in-memory TTL cache as /api/entitlement.
 * MockEntitlementResolver returns FREE_PLAN_LIMITS + FREE_QUOTA_POOLS.
 */

import { NextResponse } from "next/server";
import { getEntitlementResolver } from "../../../entitlement/resolver";
import { getPermissionSession as getSession, getPlatformUserContext } from "../../../auth/lib/session";
import { productAssigned } from "../../../platform/access";
import { fetchPlatformEntitlement } from "../../../entitlement/platform-client";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
 try {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  }
  if (!session.workspaceId) return NextResponse.json({ error: "workspace_required" }, { status: 409, headers: NO_STORE });
  const mock = process.env.NODE_ENV !== "production" && process.env.MOCK_AUTH === "true";
  const context = mock ? undefined : await getPlatformUserContext(session);
  if (context && !await productAssigned(context)) {
    return NextResponse.json({ error: "product_access_denied" }, { status: 403, headers: NO_STORE });
  }

  const quota = context ? (await fetchPlatformEntitlement(session.workspaceId, context)).quota
    : await getEntitlementResolver().resolveQuota(session.workspaceId);

  return NextResponse.json(quota, { headers: NO_STORE });
 } catch {
  return NextResponse.json({ error: "entitlement_unavailable" }, { status: 503, headers: NO_STORE });
 }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
