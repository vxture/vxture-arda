/**
 * POST /api/v1/access-requests - submit a data access / sharing request
 * (Sec-BL4) as the calling agent; it lands in the workspace admin approval
 * center as `pending`. Decisions stay a human/UI concern (approvals screen).
 * Auth: x-arda-api-key with the access:write scope. Conventions:
 * arda_data_180 (honors Idempotency-Key).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "../../../lib/api/auth";
import { readIdempotencyKey, runIdempotentCreate, storedIdempotencyKey } from "../../../lib/api/idempotency";
import { problem } from "../../../lib/api/problem";
import { parseBody } from "../../../lib/api/query";
import { API_SCOPES } from "../../../lib/api/scopes";
import { writeAudit } from "../../../lib/audit";
import { prisma } from "../../../lib/db";

const CREATE_ACTION = "access.request.submit";

const CREATE_BODY = z
  .object({
    datasetId: z.string().trim().min(1).max(64),
    useCase: z.string().trim().min(1).max(200),
    justification: z.string().trim().min(1).max(1000),
    scope: z.string().trim().min(1).max(200).optional(),
    duration: z.string().trim().min(1).max(120).optional(),
    method: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

interface AccessRequestView {
  id: string;
  datasetId: string | null;
  requesterSub: string;
  requesterName: string | null;
  useCase: string;
  scope: string | null;
  justification: string;
  duration: string | null;
  method: string | null;
  status: string;
  createdAt: string;
}

function toView(r: {
  id: string;
  datasetId: string | null;
  requesterSub: string;
  requesterName: string | null;
  useCase: string;
  scope: string | null;
  justification: string;
  duration: string | null;
  method: string | null;
  status: string;
  createdAt: Date;
}): AccessRequestView {
  return {
    id: r.id,
    datasetId: r.datasetId,
    requesterSub: r.requesterSub,
    requesterName: r.requesterName,
    useCase: r.useCase,
    scope: r.scope,
    justification: r.justification,
    duration: r.duration,
    method: r.method,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, API_SCOPES.ACCESS_WRITE);
  if (auth instanceof NextResponse) return auth;

  const idem = readIdempotencyKey(req);
  if ("invalid" in idem) return problem(400, "invalid_idempotency_key");
  const storedKey = idem.key ? storedIdempotencyKey(auth.workspaceId, idem.key) : null;

  const parsed = await parseBody(req, CREATE_BODY);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  // Access requests target tenant-owned assets (mirror of the UI action).
  const dataset = await prisma.dataset.findFirst({
    where: { workspaceId: auth.workspaceId, id: body.datasetId },
    select: { id: true, name: true },
  });
  if (!dataset) return problem(404, "not_found");

  const outcome = await runIdempotentCreate(
    { storedKey, action: CREATE_ACTION },
    async () =>
      prisma.$transaction(async (tx) => {
        const row = await tx.accessRequest.create({
          data: {
            workspaceId: auth.workspaceId,
            datasetId: dataset.id,
            requesterSub: auth.actor,
            requesterName: auth.consumerApp,
            useCase: body.useCase,
            scope: body.scope ?? null,
            justification: body.justification,
            duration: body.duration ?? null,
            method: body.method ?? null,
            status: "pending",
          },
        });
        await writeAudit(tx, {
          workspaceId: auth.workspaceId,
          actor: auth.actor,
          action: CREATE_ACTION,
          target: row.id,
          metadata: { dataset: dataset.name, useCase: body.useCase },
          idempotencyKey: storedKey ?? undefined,
        });
        return toView(row);
      }),
    async (targetId) => {
      const row = await prisma.accessRequest.findFirst({ where: { id: targetId, workspaceId: auth.workspaceId } });
      return row ? toView(row) : null;
    },
  );

  if (outcome.kind === "conflict") return problem(409, "idempotency_conflict");
  if (outcome.kind === "replayed") {
    return NextResponse.json(outcome.value, { status: 200, headers: { "idempotency-replayed": "true" } });
  }
  return NextResponse.json(outcome.value, { status: 201 });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
