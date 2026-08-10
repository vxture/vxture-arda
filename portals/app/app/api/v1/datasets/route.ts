/**
 * GET /api/v1/datasets - list catalog datasets (workspace + platform overlay).
 * Auth: x-arda-api-key with the catalog:read scope. Conventions: arda_data_180.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "../../../lib/api/auth";
import { parsePage, parseQuery } from "../../../lib/api/query";
import { API_SCOPES } from "../../../lib/api/scopes";
import { listDatasets } from "../../../lib/reads/catalog";

const QUERY = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  domain: z.string().trim().min(1).max(120).optional(),
  classification: z.enum(["public", "internal", "sensitive", "core"]).optional(),
  type: z.string().trim().min(1).max(60).optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, API_SCOPES.CATALOG_READ);
  if (auth instanceof NextResponse) return auth;

  const parsed = parseQuery(req, QUERY);
  if (!parsed.ok) return parsed.response;
  const page = parsePage(parsed.value);
  if (!page.ok) return page.response;

  const { q, domain, classification, type } = parsed.value;
  const result = await listDatasets(auth.workspaceId, {
    limit: page.limit,
    cursorId: page.cursorId,
    q,
    domain,
    classification,
    type,
  });
  return NextResponse.json(result);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
