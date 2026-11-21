import { NextResponse } from "next/server";
import { getEntitlementResolver } from "../../entitlement/resolver";
import type { Subscription } from "../../entitlement/types";
import { getSession } from "../../auth/lib/session";

// Resolve authoritative C2 facts without stale fallback for the entry boundary.
const NO_STORE = { "Cache-Control": "no-store" };
export async function GET() {
 try {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  }
  if (!session.workspaceId) return NextResponse.json({ error: "workspace_required" }, { status: 409, headers: NO_STORE });

  const resolver = getEntitlementResolver();
  const subscription: Subscription = await (resolver.resolveFresh ?? resolver.resolve).call(resolver, session.ardaClaim, session.workspaceId);

  return NextResponse.json(subscription, { headers: NO_STORE });
 } catch {
  return NextResponse.json({ error: "entitlement_unavailable" }, { status: 503, headers: NO_STORE });
 }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
