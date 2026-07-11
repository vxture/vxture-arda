/**
 * GET /api/usage/flush
 * Triggers the consume flush job. INTERNAL-ONLY (arda-plat-220 §4 / B2).
 *
 * Fail-closed: the endpoint is DISABLED (404) unless INTERNAL_JOB_TOKEN is set
 * AND the caller presents a matching x-internal-job-token header. This keeps it
 * inert on the public edge (which blanket-proxies /) - a public caller with no
 * token gets a plain 404 and never triggers a flush. Defense-in-depth alongside
 * the edge-level 404 for this path (configs/edge/*.conf).
 *
 * Intended caller = an internal cron/job on the tailnet that holds the token.
 */

import { NextRequest, NextResponse } from "next/server";
import { flushUsage } from "../../../usage/lib/flush";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Constant-time string compare (avoid token-length/value timing leaks). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.INTERNAL_JOB_TOKEN;
  const provided = request.headers.get("x-internal-job-token");
  // Disabled unless a token is configured and matches. 404 (not 401) so the
  // endpoint's existence is not advertised to unauthenticated callers.
  if (!expected || !provided || !safeEqual(provided, expected)) {
    return new NextResponse(null, { status: 404 });
  }

  const result = await flushUsage();
  return NextResponse.json(result);
}
