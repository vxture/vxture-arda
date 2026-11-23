import { NextResponse } from "next/server";
import { getSession, getProductSession, getPlatformUserContext } from "../../../auth/lib/session";
import { permits } from "../../../authz/policy";
import { listLocalRoles } from "../../../authz/store";
import { authorizedRoster } from "../../../platform/roster";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers });
    const admitted = await getProductSession();
    if (!permits(admitted?.productAccess,"members.manage"))
      return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    if (new URL(req.url).search) return NextResponse.json({ error: "context_from_session_only" }, { status: 400, headers });
    const roster = await authorizedRoster(await getPlatformUserContext(session));
    const local = await listLocalRoles(session.workspaceId);
    return NextResponse.json({ ...roster, actorRoles: admitted?.productAccess?.roles ?? [], items: roster.items.map(member => ({ ...member,
      status: local.find(m=>m.sub===member.subject)?.status ?? "active",
      productRoles: local.find(m=>m.sub===member.subject)?.roles ?? [],
      initialized: local.some(m=>m.sub===member.subject), defaultRole: "readonly" })) }, { headers });
  } catch { return NextResponse.json({ error: "roster_unavailable" }, { status: 503, headers }); }
}
