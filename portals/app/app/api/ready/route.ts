import { NextResponse } from "next/server";
import { buildHealthIdentity } from "@vxture/shared";
import { checkDependencies } from "../../lib/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Readiness is dependency-aware; /api/health remains pure liveness.
// Expose status booleans only, never connection strings or raw errors.
export async function GET() {
  const { database, redis } = await checkDependencies();
  const ready = database && redis;
  return NextResponse.json({ ...buildHealthIdentity({ service: "arda-app" }),
    status: ready ? "ready" : "fail",
    checks: { db: database ? "ok" : "fail", redis: redis ? "ok" : "fail" } },
  { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
