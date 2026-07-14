/**
 * GET /api/jobs/refresh
 * Scheduled freshness tick (I-BL2 + Q-BL1 periodic): sync live sources, rerun
 * quality checks, re-report storage gauges. INTERNAL-ONLY - same fail-closed
 * INTERNAL_JOB_TOKEN guard as /api/usage/flush and /api/lifecycle/sweep.
 * Cadence lives in the host crontab.
 */

import { NextRequest, NextResponse } from "next/server";
import { refreshAll } from "../../../jobs/refresh";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.INTERNAL_JOB_TOKEN;
  const provided = request.headers.get("x-internal-job-token");
  if (!expected || !provided || !safeEqual(expected, provided)) {
    return new NextResponse(null, { status: 404 });
  }
  const result = await refreshAll();
  return NextResponse.json(result);
}
