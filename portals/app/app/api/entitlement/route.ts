import { NextResponse } from "next/server";
import { getEntitlementResolver } from "../../entitlement/resolver";
import type { Subscription } from "../../entitlement/types";
import { getSession } from "../../auth/lib/session";

// Resolves the current user's Arda entitlement. The `arda` scope claim in the
// access token is the authoritative source; it is parsed at session creation
// (claims.ts) and stored alongside identity in Redis. When the claim is absent
// (local dev without a real IdP) the MockEntitlementResolver falls back to the
// MOCK_STATE / MOCK_TIER env vars.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const resolver = getEntitlementResolver();
  const subscription: Subscription = await resolver.resolve(session.ardaClaim, session.workspaceId);

  return NextResponse.json(subscription);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
