import { resolveProductAccess } from "../../authz/store";
import { hasProductAccess } from "../../entitlement/types";
import { NextResponse } from "next/server";
import { getEntitlementResolver } from "../../entitlement/resolver";
import type { Subscription } from "../../entitlement/types";
import { getSession, getPlatformUserContext } from "../../auth/lib/session";
import { productAssigned } from "../../platform/access";
import { fetchPlatformEntitlement } from "../../entitlement/platform-client";

// Resolve authoritative C2 facts without stale fallback for the entry boundary.
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
  const subscription: Subscription = context
    ? (await fetchPlatformEntitlement(session.workspaceId, context)).subscription
    : await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  const assigned = context ? await productAssigned(context) : true;
  const productAccess = assigned && hasProductAccess(subscription) && context
    ? await resolveProductAccess({ workspaceId: session.workspaceId, sub: session.sub, roles: session.roles })
    : mock ? { roles: ["owner"], permissions: ["product.enter", "data.read", "data.write", "product.manage"] } : { roles: [], permissions: [] };
  return NextResponse.json({ ...subscription, productAssigned: assigned, productAccess }, { headers: NO_STORE });
 } catch {
  return NextResponse.json({ error: "entitlement_unavailable" }, { status: 503, headers: NO_STORE });
 }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
