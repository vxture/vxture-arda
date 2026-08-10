/**
 * GET /api/v1/lineage - dataset-level lineage as a raw edge list plus a
 * dataset name map. Optional datasetId narrows to edges touching that dataset
 * (404 when it is not visible to the key's workspace). Edge cap reported via
 * `truncated`, never silent.
 * Auth: x-arda-api-key with the lineage:read scope. Conventions: arda_data_180.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "../../../lib/api/auth";
import { problem } from "../../../lib/api/problem";
import { parseQuery } from "../../../lib/api/query";
import { API_SCOPES } from "../../../lib/api/scopes";
import { datasetVisible, getLineageGraph } from "../../../lib/reads/lineage";

const QUERY = z.object({
  datasetId: z.string().trim().min(1).max(64).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await authenticateApiRequest(req, API_SCOPES.LINEAGE_READ);
  if (auth instanceof NextResponse) return auth;

  const parsed = parseQuery(req, QUERY);
  if (!parsed.ok) return parsed.response;

  const { datasetId } = parsed.value;
  if (datasetId && !(await datasetVisible(auth.workspaceId, datasetId))) {
    return problem(404, "not_found");
  }

  const graph = await getLineageGraph(auth.workspaceId, datasetId);
  return NextResponse.json(graph);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
