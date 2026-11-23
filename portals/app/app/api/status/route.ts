import { NextResponse } from "next/server";
import { readStatus, statusAccess } from "../../lib/status-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const access = await statusAccess();
  const headers = { "Cache-Control": "no-store" };
  if (access !== 200) {
    return new NextResponse(access === 404 ? "not found" : "unauthorized", { status: access, headers });
  }

  return NextResponse.json(await readStatus(), { headers });
}
