import { NextResponse } from "next/server";
import { getSession, getProductSession, getPlatformUserContext } from "../../../auth/lib/session";
import { isWorkspaceAdmin } from "../../../entitlement/roles";
import { authorizedRoster } from "../../../platform/roster";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers });
    if (!isWorkspaceAdmin(session.roles) || !await getProductSession())
      return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    if (new URL(req.url).search) return NextResponse.json({ error: "context_from_session_only" }, { status: 400, headers });
    return NextResponse.json(await authorizedRoster(await getPlatformUserContext(session)), { headers });
  } catch { return NextResponse.json({ error: "roster_unavailable" }, { status: 503, headers }); }
}
