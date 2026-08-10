/**
 * GET /api/v1/quality-results - list quality check runs, newest first (tenant
 * data, force-filtered by the key's workspace).
 * Auth: x-arda-api-key with the quality:read scope. Conventions: arda_data_180.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "../../../lib/api/auth";
import { parsePage, parseQuery } from "../../../lib/api/query";
import { API_SCOPES } from "../../../lib/api/scopes";
import { listQualityResults } from "../../../lib/reads/quality";

const QUERY = z.object({
  datasetId: z.string().trim().min(1).max(64).optional(),
  ruleId: z.string().trim().min(1).max(64).optional(),
  status: z.enum(["pass", "warn", "fail"]).optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, API_SCOPES.QUALITY_READ);
  if (auth instanceof NextResponse) return auth;

  const parsed = parseQuery(req, QUERY);
  if (!parsed.ok) return parsed.response;
  const page = parsePage(parsed.value);
  if (!page.ok) return page.response;

  const result = await listQualityResults(auth.workspaceId, {
    limit: page.limit,
    cursorId: page.cursorId,
    datasetId: parsed.value.datasetId,
    ruleId: parsed.value.ruleId,
    status: parsed.value.status,
  });
  return NextResponse.json(result);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
