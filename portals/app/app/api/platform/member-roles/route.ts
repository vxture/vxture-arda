import { getOidcConfig } from "../../../auth/lib/config";
import { NextResponse } from "next/server";
import { changeMemberRoles, transferOwnership } from "../../../authz/store";
import { PRODUCT_ROLES, type ProductRole } from "../../../authz/policy";
import { authorizedRoster } from "../../../platform/roster";
import { getPermissionSession, getPlatformUserContext } from "../../../auth/lib/session";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(req: Request) {
  // Use request origin, including at the reverse proxy, and require browser's
  // same-origin Fetch Metadata. Never accept cross-origin management mutations.
  const origin = req.headers.get("origin");
  const publicOrigin = getOidcConfig()?.appOrigin;
  if (!origin || origin !== publicOrigin || req.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json({ error: "origin_invalid" }, { status: 403, headers });
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return NextResponse.json({ error: "json_required" }, { status: 415, headers });
  try {
    const session = await getPermissionSession("members.manage");
    if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    const identity = { workspaceId: session.workspaceId, sub: session.sub, roles: session.roles };
    const context = await getPlatformUserContext(session);
    const text = await req.text();
    if (text.length > 4096) return NextResponse.json({ error: "invalid" }, { status: 400, headers });
    let body: { subject?: unknown; roles?: unknown; action?: unknown };
    try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "invalid" }, { status: 400, headers }); }
    if (!body || typeof body.subject !== "string" || !/^usr_[0-9a-f-]{36}$/i.test(body.subject))
      return NextResponse.json({ error: "invalid" }, { status: 400, headers });
    const target = body.subject;
    const eligible = async () => (await authorizedRoster(context)).items.some(m => m.subject === target);
    if (body.action === "transfer") {
      await transferOwnership(identity,target,eligible);
    } else if (body.action === "roles" && Array.isArray(body.roles) && body.roles.every(r => PRODUCT_ROLES.includes(r as ProductRole))) {
      await changeMemberRoles(identity,target,body.roles as ProductRole[],eligible);
    } else return NextResponse.json({ error: "invalid" }, { status: 400, headers });
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "unavailable";
    const denied = ["role_forbidden","target_not_authorized","member_inactive","target_member_required","owner_transfer_required"].includes(code);
    const invalid = ["role_change_invalid","owner_transfer_invalid","role_identity_invalid"].includes(code);
    return NextResponse.json({ error: denied || invalid ? code : "role_update_unavailable" }, { status: denied ? 403 : invalid ? 400 : 503, headers });
  }
}
