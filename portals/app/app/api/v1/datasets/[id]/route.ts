/**
 * GET /api/v1/datasets/{id} - dataset detail (profile aggregate: source, tags,
 * standards, services, derived quality summary, lineage degree).
 * Auth: x-arda-api-key with the catalog:read scope. Conventions: arda_data_180.
 */

import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiRequest } from "../../../../lib/api/auth";
import { problem } from "../../../../lib/api/problem";
import { API_SCOPES } from "../../../../lib/api/scopes";
import { getDatasetDetail } from "../../../../lib/reads/catalog";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(req, API_SCOPES.CATALOG_READ);
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const detail = await getDatasetDetail(auth.workspaceId, id);
  if (!detail) return problem(404, "not_found");
  return NextResponse.json(detail);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
