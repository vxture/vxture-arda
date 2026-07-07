/**
 * GET /api/usage/flush
 * Triggers the consume flush job. Internal-only: not exposed to end users.
 * Called by a cron trigger or on startup. Can safely be called concurrently
 * (Prisma writes are row-level; duplicate calls just find no unflushed rows).
 */

import { NextResponse } from "next/server";
import { flushUsage } from "../../../usage/lib/flush";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const result = await flushUsage();
  return NextResponse.json(result);
}
