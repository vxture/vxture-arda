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
import { getSession } from "../../../auth/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const resolver = getEntitlementResolver();
  const quota = await resolver.resolveQuota(session.workspaceId);

  return NextResponse.json(quota);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
