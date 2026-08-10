/**
 * GET  /api/v1/datasets - list catalog datasets (workspace + platform overlay).
 * POST /api/v1/datasets - register a dataset produced by the calling agent
 *   (ownerApp = the key's consumerApp; data-170 1: agents publish as owners).
 * Auth: x-arda-api-key with catalog:read / catalog:write. Conventions:
 * arda_data_180 (writes honor Idempotency-Key and the datasetMax quota).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getEntitlementResolver } from "../../../entitlement/resolver";
import { authenticateApiRequest } from "../../../lib/api/auth";
import {
  isUniqueViolation,
  readIdempotencyKey,
  runIdempotentCreate,
  storedIdempotencyKey,
} from "../../../lib/api/idempotency";
import { problem } from "../../../lib/api/problem";
import { parseBody, parsePage, parseQuery } from "../../../lib/api/query";
import { API_SCOPES } from "../../../lib/api/scopes";
import { writeAudit } from "../../../lib/audit";
import { prisma } from "../../../lib/db";
import { getDatasetSummary, listDatasets, toDatasetSummary } from "../../../lib/reads/catalog";

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

const CREATE_ACTION = "catalog.dataset.register";

const CREATE_BODY = z
  .object({
    code: z.string().regex(/^[\x21-\x7e]{1,120}$/, "printable ASCII without spaces, 1-120 chars"),
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2000).optional(),
    domain: z.string().trim().min(1).max(120).optional(),
    team: z.string().trim().min(1).max(120).optional(),
    type: z.enum(["table", "view", "file", "stream"]),
    location: z.string().trim().min(1).max(500).optional(),
    classification: z.enum(["public", "internal", "sensitive", "core"]).default("internal"),
    refreshFreq: z.enum(["realtime", "daily", "weekly", "monthly"]).optional(),
    rowCountEst: z.number().int().nonnegative().optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req, API_SCOPES.CATALOG_WRITE);
  if (auth instanceof NextResponse) return auth;

  const idem = readIdempotencyKey(req);
  if ("invalid" in idem) return problem(400, "invalid_idempotency_key");
  const storedKey = idem.key ? storedIdempotencyKey(auth.workspaceId, idem.key) : null;

  const parsed = await parseBody(req, CREATE_BODY);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;

  // Same quota gate as source sync (no silent caps): tenant-owned datasets only.
  const [quota, count] = await Promise.all([
    getEntitlementResolver().resolveQuota(auth.workspaceId),
    prisma.dataset.count({ where: { workspaceId: auth.workspaceId } }),
  ]);
  const datasetMax = quota.limits.datasetMax; // null = unlimited
  if (datasetMax !== null && count >= datasetMax) {
    return problem(403, "quota_exceeded", `Workspace dataset quota reached (${datasetMax}).`);
  }

  const duplicate = await prisma.dataset.findFirst({
    where: { workspaceId: auth.workspaceId, code: body.code },
    select: { id: true },
  });
  if (duplicate) return problem(409, "duplicate_code", `Dataset code '${body.code}' already exists.`);

  try {
    const outcome = await runIdempotentCreate(
      { storedKey, action: CREATE_ACTION },
      async () => {
        const created = await prisma.$transaction(async (tx) => {
          const row = await tx.dataset.create({
            data: {
              workspaceId: auth.workspaceId,
              code: body.code,
              name: body.name,
              description: body.description ?? null,
              domain: body.domain ?? null,
              team: body.team ?? null,
              type: body.type,
              location: body.location ?? null,
              classification: body.classification,
              refreshFreq: body.refreshFreq ?? null,
              rowCountEst: body.rowCountEst ?? null,
              sizeBytes: body.sizeBytes ?? null,
              ownerApp: auth.consumerApp,
            },
          });
          await writeAudit(tx, {
            workspaceId: auth.workspaceId,
            actor: auth.actor,
            action: CREATE_ACTION,
            target: row.id,
            metadata: { code: row.code, name: row.name, classification: row.classification },
            idempotencyKey: storedKey ?? undefined,
          });
          return row;
        });
        return toDatasetSummary(created);
      },
      (targetId) => getDatasetSummary(auth.workspaceId, targetId),
    );

    if (outcome.kind === "conflict") return problem(409, "idempotency_conflict");
    if (outcome.kind === "replayed") {
      return NextResponse.json(outcome.value, { status: 200, headers: { "idempotency-replayed": "true" } });
    }
    return NextResponse.json(outcome.value, {
      status: 201,
      headers: { location: `/api/v1/datasets/${outcome.value.id}` },
    });
  } catch (e) {
    if (isUniqueViolation(e, "code")) {
      return problem(409, "duplicate_code", `Dataset code '${body.code}' already exists.`);
    }
    throw e;
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
