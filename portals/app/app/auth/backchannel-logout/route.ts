import { NextRequest, NextResponse } from "next/server";
import { getOidcConfig } from "../lib/config";
import { verifyToken } from "../lib/oidc";
import { destroyBySid } from "../lib/session-store";
import { receiveBackchannelLogout } from "../lib/backchannel-logout";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Verified, idempotent central logout. Deletion failure returns retryable503. */
export async function POST(request: NextRequest) {
  const cfg = getOidcConfig();
  if (!cfg) return new NextResponse(null, { status: 501, headers: { "Cache-Control": "no-store" } });
  return receiveBackchannelLogout(request, {
    verify: token => verifyToken(cfg, token),
    destroy: sid => destroyBySid(cfg, sid),
  });
}
