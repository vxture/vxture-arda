import { NextResponse } from "next/server";
import { getEntitlementResolver } from "../../entitlement/resolver";
import type { Subscription } from "../../entitlement/types";
import { getSession } from "../../auth/lib/session";

// Resolves the current workspace's Arda subscription. Entitlement is an
// out-of-band lookup keyed by tenant/workspace (Vxture access tokens carry no
// entitlement claims; Identity Platform section 6.3), so this route reads the
// tenant/workspace from the authenticated session and asks the entitlement
// resolver. No session -> 401 (the AccountGate above should have authenticated
// the user, but the API fails closed).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const resolver = getEntitlementResolver();
  const subscription: Subscription = await resolver.resolve({
    tenantId: session.tenantId,
    workspaceId: session.workspaceId,
    app: "arda",
  });

  return NextResponse.json(subscription);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
