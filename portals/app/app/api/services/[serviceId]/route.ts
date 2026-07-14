/**
 * External data-service gateway (Svc-BL1 minimal + Sec-BL1/BL2/BL3).
 *
 * GET /api/services/{serviceId}
 *   Auth: x-arda-api-key header (sha256 lookup; revocation + optional
 *   per-service binding enforced).
 *
 * Egress invariants collected here (agent-support §3 / biz-441):
 *   - workspace isolation: everything scoped by the key's workspaceId
 *   - classification filter (Sec-BL2): datasets above the workspace's max
 *     external level are excluded (excluded count reported, never silent)
 *   - masking (Sec-BL1): pushed down into the source query via the connector;
 *     clear values of masked columns never leave the source
 *   - access audit (Sec-BL3): every call writes service.access
 *   - metering: service.api.call buffered (divisible post-report, reply-01 R5)
 *
 * Rows transit arda as a live proxy and are never persisted (data-150 D6).
 */

import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { METRICS } from "../../../entitlement/quota";
import { prisma } from "../../../lib/db";
import { unseal, type SealedSecret } from "../../../lib/seal";
import { recordUsage } from "../../../usage/lib/buffer";
import { getConnector } from "../../../(app)/sources/connectors";
import { levelAllowed, maskedColumnsFor, resolveEgressPolicy } from "../../../(app)/service/egress-policy";

const ROW_LIMIT_DEFAULT = 20;

export async function GET(req: NextRequest, ctx: { params: Promise<{ serviceId: string }> }) {
  const rawKey = req.headers.get("x-arda-api-key");
  if (!rawKey) return NextResponse.json({ error: "missing_api_key" }, { status: 401 });

  const hashedKey = createHash("sha256").update(rawKey).digest("hex");
  const key = await prisma.apiKey.findUnique({ where: { hashedKey } });
  if (!key || key.revoked) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });

  const { serviceId } = await ctx.params;
  if (key.dataServiceId && key.dataServiceId !== serviceId) {
    return NextResponse.json({ error: "key_not_valid_for_service" }, { status: 403 });
  }

  // Workspace scoping comes from the KEY, never from the caller.
  const service = await prisma.dataService.findFirst({
    where: { workspaceId: key.workspaceId, id: serviceId },
    include: { datasets: { include: { dataset: { include: { source: true } } } } },
  });
  if (!service) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (service.status !== "running") return NextResponse.json({ error: "not_published" }, { status: 409 });

  const policy = await resolveEgressPolicy(key.workspaceId);
  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get("limit")) || ROW_LIMIT_DEFAULT, 100));

  const included: unknown[] = [];
  let excludedByClassification = 0;

  for (const link of service.datasets) {
    const ds = link.dataset;
    // Sec-BL2: classification travels with the data - too-high levels never egress.
    if (!levelAllowed(ds.classification, policy.maxExternalLevel)) {
      excludedByClassification += 1;
      continue;
    }

    const base = {
      code: ds.code,
      name: ds.name,
      type: ds.type,
      classification: ds.classification,
      location: ds.location,
    };

    const connector = ds.source ? getConnector(ds.source.type) : null;
    if (!connector?.fetchGovernedRows || !ds.source?.connectionConfig || !ds.location) {
      included.push({ ...base, rows: null, note: "metadata_only" });
      continue;
    }

    try {
      const config = unseal(ds.source.connectionConfig as unknown as SealedSecret);
      const masked = maskedColumnsFor(policy, ds.id);
      const result = await connector.fetchGovernedRows(config, ds.location, masked, limit);
      included.push({ ...base, columns: result.columns, maskedColumns: result.maskedColumns, rows: result.rows });
    } catch {
      included.push({ ...base, rows: null, note: "source_unavailable" });
    }
  }

  await Promise.all([
    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }),
    prisma.auditLog.create({
      data: {
        workspaceId: key.workspaceId,
        actor: `apikey:${key.consumerApp ?? key.name}`,
        action: "service.access",
        target: service.id,
        metadata: {
          service: service.name,
          datasets: included.length,
          excludedByClassification,
          maxExternalLevel: policy.maxExternalLevel,
        },
      },
    }),
    recordUsage({
      workspaceId: key.workspaceId,
      metric: METRICS.SERVICE_API_CALL,
      amount: 1,
      idempotencyKey: `arda:${METRICS.SERVICE_API_CALL}:${randomUUID()}`,
    }),
  ]);

  return NextResponse.json({
    service: { id: service.id, name: service.name, type: service.type },
    datasets: included,
    excludedByClassification,
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
