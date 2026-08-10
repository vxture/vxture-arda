/**
 * GET  /api/v1/lineage - dataset-level lineage as a raw edge list plus a
 * dataset name map. Optional datasetId narrows to edges touching that dataset
 * (404 when it is not visible to the key's workspace). Edge cap reported via
 * `truncated`, never silent.
 * POST /api/v1/lineage - record one curated lineage edge (agent-declared
 * provenance; L-BL2 manual-first). Cycles rejected (lineage is a DAG).
 * Auth: x-arda-api-key with lineage:read / lineage:write. Conventions:
 * arda_data_180 (writes honor Idempotency-Key).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { wouldCreateCycle } from "../../../(app)/lineage/graph-core";
import { authenticateApiRequest } from "../../../lib/api/auth";
import {
  findIdempotentReplay,
  isUniqueViolation,
  readIdempotencyKey,
  runIdempotentCreate,
  storedIdempotencyKey,
} from "../../../lib/api/idempotency";
import { problem } from "../../../lib/api/problem";
import { parseBody, parseQuery } from "../../../lib/api/query";
import { API_SCOPES } from "../../../lib/api/scopes";
import { writeAudit } from "../../../lib/audit";
import { prisma } from "../../../lib/db";
import { datasetVisible, getLineageGraph, type LineageEdgeView } from "../../../lib/reads/lineage";

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

const CREATE_ACTION = "lineage.change";

const CREATE_BODY = z
  .object({
    upstreamDatasetId: z.string().trim().min(1).max(64),
    downstreamDatasetId: z.string().trim().min(1).max(64),
    transform: z.string().trim().min(1).max(500).optional(),
    jobId: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine((b) => b.upstreamDatasetId !== b.downstreamDatasetId, {
    message: "upstreamDatasetId and downstreamDatasetId must differ",
  });

function toEdgeView(e: {
  id: string;
  upstreamDatasetId: string;
  downstreamDatasetId: string;
  transform: string | null;
  jobId: string | null;
}): LineageEdgeView {
  return {
    id: e.id,
    upstreamDatasetId: e.upstreamDatasetId,
    downstreamDatasetId: e.downstreamDatasetId,
    transform: e.transform,
    jobId: e.jobId,
  };
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, API_SCOPES.LINEAGE_WRITE);
  if (auth instanceof NextResponse) return auth;

  const idem = readIdempotencyKey(req);
  if ("invalid" in idem) return problem(400, "invalid_idempotency_key");
  const storedKey = idem.key ? storedIdempotencyKey(auth.workspaceId, idem.key) : null;

  const parsed = await parseBody(req, CREATE_BODY);
  if (!parsed.ok) return parsed.response;
  const { upstreamDatasetId: up, downstreamDatasetId: down } = parsed.value;

  const fetchEdge = async (targetId: string) => {
    const row = await prisma.lineageEdge.findFirst({ where: { id: targetId, workspaceId: auth.workspaceId } });
    return row ? toEdgeView(row) : null;
  };

  // Replay check BEFORE the duplicate/cycle pre-checks: the edge the original
  // request created would otherwise report duplicate_edge.
  if (storedKey) {
    const replay = await findIdempotentReplay(storedKey, CREATE_ACTION, fetchEdge);
    if (replay?.kind === "conflict") return problem(409, "idempotency_conflict");
    if (replay) {
      return NextResponse.json(replay.value, { status: 200, headers: { "idempotency-replayed": "true" } });
    }
  }

  // Both endpoints must be tenant-owned datasets of THIS workspace
  // (LineageEdge.workspaceId is non-null; platform reference assets carry no
  // workspace-scoped lineage).
  const endpoints = await prisma.dataset.findMany({
    where: { workspaceId: auth.workspaceId, id: { in: [up, down] } },
    select: { id: true, name: true },
  });
  if (endpoints.length !== 2) return problem(404, "not_found", "One or both datasets do not exist in this workspace.");

  const existing = await prisma.lineageEdge.findMany({
    where: { workspaceId: auth.workspaceId },
    select: { upstreamDatasetId: true, downstreamDatasetId: true },
  });
  if (existing.some((e) => e.upstreamDatasetId === up && e.downstreamDatasetId === down)) {
    return problem(409, "duplicate_edge");
  }
  if (wouldCreateCycle(up, down, existing.map((e) => ({ from: e.upstreamDatasetId, to: e.downstreamDatasetId })))) {
    return problem(409, "cycle_detected", "Adding this edge would create a cycle; lineage is a DAG.");
  }

  const transform = parsed.value.transform ?? null;
  const jobId = parsed.value.jobId ?? null;

  try {
    const outcome = await runIdempotentCreate(
      { storedKey, action: CREATE_ACTION },
      async () =>
        prisma.$transaction(async (tx) => {
          const row = await tx.lineageEdge.create({
            data: { workspaceId: auth.workspaceId, upstreamDatasetId: up, downstreamDatasetId: down, transform, jobId },
          });
          await writeAudit(tx, {
            workspaceId: auth.workspaceId,
            actor: auth.actor,
            action: CREATE_ACTION,
            target: row.id,
            metadata: {
              upstream: endpoints.find((e) => e.id === up)?.name,
              downstream: endpoints.find((e) => e.id === down)?.name,
              transform,
              jobId,
            },
            idempotencyKey: storedKey ?? undefined,
          });
          return toEdgeView(row);
        }),
      fetchEdge,
    );

    if (outcome.kind === "conflict") return problem(409, "idempotency_conflict");
    if (outcome.kind === "replayed") {
      return NextResponse.json(outcome.value, { status: 200, headers: { "idempotency-replayed": "true" } });
    }
    return NextResponse.json(outcome.value, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e, "upstreamDatasetId")) return problem(409, "duplicate_edge");
    throw e;
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
