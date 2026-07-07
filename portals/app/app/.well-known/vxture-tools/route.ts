/**
 * GET /.well-known/vxture-tools
 *
 * L0 tool protocol discovery endpoint (product_210_tool-protocol.md v1.0).
 * v1 architecture reserve: route exists, returns empty tool list.
 * Populated when arda implements T1-T3 tool obligations (post-v1).
 *
 * Contract: vxture tool protocol requires providers to expose this endpoint
 * so agents can discover available tools and their schemas. S2S token
 * validation (same JWKS as RP, eight-rule discipline) is a pre-condition
 * for any tool serving - implemented alongside T1.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    product: "arda",
    version: "v1",
    tools: [],
    // tools populated in T1-T3 implementation phases (post-v1)
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
