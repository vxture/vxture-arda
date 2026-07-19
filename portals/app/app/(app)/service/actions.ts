"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { canUseFeature } from "../../entitlement/capability";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { prisma } from "../../lib/db";
import type { AssetLevel } from "../dashboard/seed";
import { qualityGate, type QualityGateVerdict } from "./quality-gate";

const ASSET_LEVELS = new Set<AssetLevel>(["public", "internal", "sensitive", "core"]);
const METHODS = new Set(["GET", "POST"]);
const TYPES = new Set(["rest_api", "query", "export", "share"]);
const DOMAIN_KEYS = new Set(["customer", "product", "marketing", "finance", "operations", "web"]);
const PATH_RE = /^\/[A-Za-z0-9/_.:-]{0,200}$/;

export type ServiceWriteResult =
  | { ok: true; id: string }
  | { ok: false; error: "unauthenticated" | "forbidden" | "tier" | "invalid" | "not_found" | "running" };

export interface ServiceInput {
  name: string;
  path: string;
  method: string;
  type: string;
  level: string;
  domain: string | null;
  description: string | null;
  datasetIds: string[];
}

type Authed = NonNullable<Awaited<ReturnType<typeof getSession>>>;

async function authorizeWrite(): Promise<{ ok: true; session: Authed } | { ok: false; error: "unauthenticated" | "forbidden" | "tier" }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };
  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.services.publish_api")) return { ok: false, error: "tier" };
  return { ok: true, session };
}

/** Validate + normalize a service input against the workspace's datasets. */
function validateInput(input: ServiceInput): { ok: true; value: Required<ServiceInput> } | { ok: false } {
  const name = input.name.trim();
  const path = input.path.trim();
  if (!name || name.length > 120) return { ok: false };
  if (!PATH_RE.test(path)) return { ok: false };
  if (!METHODS.has(input.method) || !TYPES.has(input.type) || !ASSET_LEVELS.has(input.level as AssetLevel)) return { ok: false };
  const domain = input.domain && DOMAIN_KEYS.has(input.domain) ? input.domain : null;
  const description = input.description?.trim() ? input.description.trim().slice(0, 500) : null;
  const datasetIds = [...new Set(input.datasetIds.filter((s) => typeof s === "string" && s.length > 0))];
  return { ok: true, value: { name, path, method: input.method, type: input.type, level: input.level, domain: domain as string, description: description as string, datasetIds } };
}

async function nextServiceCode(workspaceId: string): Promise<string> {
  const existing = await prisma.dataService.findMany({ where: { workspaceId }, select: { code: true } });
  let max = 1000;
  for (const s of existing) {
    const m = /^API-(\d+)$/.exec(s.code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `API-${max + 1}`;
}

/** Create a data service as a draft (Svc-BL5). Links the selected datasets;
 *  publish (draft -> running) stays a separate, quality-gated step. */
export async function createDataService(input: ServiceInput): Promise<ServiceWriteResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;
  const { session } = auth;

  const v = validateInput(input);
  if (!v.ok) return { ok: false, error: "invalid" };

  const linked = v.value.datasetIds.length
    ? await prisma.dataset.findMany({ where: { workspaceId: session.workspaceId, id: { in: v.value.datasetIds } }, select: { id: true } })
    : [];
  const linkedIds = linked.map((d) => d.id);
  const code = await nextServiceCode(session.workspaceId);

  const service = await prisma.$transaction(async (tx) => {
    const svc = await tx.dataService.create({
      data: {
        workspaceId: session.workspaceId,
        code,
        name: v.value.name,
        path: v.value.path,
        method: v.value.method,
        type: v.value.type,
        level: v.value.level as AssetLevel,
        domain: v.value.domain,
        description: v.value.description,
        status: "draft",
      },
    });
    if (linkedIds.length) {
      await tx.dataServiceDataset.createMany({
        data: linkedIds.map((datasetId) => ({ dataServiceId: svc.id, datasetId, workspaceId: session.workspaceId })),
      });
    }
    await tx.auditLog.create({
      data: { workspaceId: session.workspaceId, actor: session.sub, action: "service.create", target: svc.id, metadata: { code, name: v.value.name, datasets: linkedIds.length } },
    });
    return svc;
  });

  revalidatePath("/service");
  revalidatePath("/service/publish");
  return { ok: true, id: service.id };
}

/** Edit a DRAFT service (a running contract is edited only after unpublish). */
export async function updateDataService(serviceId: string, input: ServiceInput): Promise<ServiceWriteResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;
  const { session } = auth;

  const existing = await prisma.dataService.findFirst({ where: { workspaceId: session.workspaceId, id: serviceId } });
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.status === "running") return { ok: false, error: "running" };

  const v = validateInput(input);
  if (!v.ok) return { ok: false, error: "invalid" };

  const linked = v.value.datasetIds.length
    ? await prisma.dataset.findMany({ where: { workspaceId: session.workspaceId, id: { in: v.value.datasetIds } }, select: { id: true } })
    : [];
  const linkedIds = linked.map((d) => d.id);

  await prisma.$transaction(async (tx) => {
    await tx.dataService.update({
      where: { id: existing.id },
      data: { name: v.value.name, path: v.value.path, method: v.value.method, type: v.value.type, level: v.value.level as AssetLevel, domain: v.value.domain, description: v.value.description },
    });
    await tx.dataServiceDataset.deleteMany({ where: { dataServiceId: existing.id } });
    if (linkedIds.length) {
      await tx.dataServiceDataset.createMany({
        data: linkedIds.map((datasetId) => ({ dataServiceId: existing.id, datasetId, workspaceId: session.workspaceId })),
      });
    }
    await tx.auditLog.create({
      data: { workspaceId: session.workspaceId, actor: session.sub, action: "service.update", target: existing.id, metadata: { code: existing.code, name: v.value.name, datasets: linkedIds.length } },
    });
  });

  revalidatePath("/service");
  revalidatePath("/service/publish");
  return { ok: true, id: existing.id };
}

/** Take a running service offline (running -> paused). Stops external egress. */
export async function unpublishDataService(serviceId: string): Promise<ServiceWriteResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;
  const { session } = auth;

  const svc = await prisma.dataService.findFirst({ where: { workspaceId: session.workspaceId, id: serviceId } });
  if (!svc) return { ok: false, error: "not_found" };

  await prisma.$transaction([
    prisma.dataService.update({ where: { id: svc.id }, data: { status: "paused" } }),
    prisma.auditLog.create({ data: { workspaceId: session.workspaceId, actor: session.sub, action: "service.unpublish", target: svc.id, metadata: { code: svc.code, name: svc.name } } }),
  ]);

  revalidatePath("/service");
  revalidatePath("/service/publish");
  return { ok: true, id: svc.id };
}

/** Delete a non-running service (its dataset links cascade). */
export async function deleteDataService(serviceId: string): Promise<ServiceWriteResult> {
  const auth = await authorizeWrite();
  if (!auth.ok) return auth;
  const { session } = auth;

  const svc = await prisma.dataService.findFirst({ where: { workspaceId: session.workspaceId, id: serviceId } });
  if (!svc) return { ok: false, error: "not_found" };
  if (svc.status === "running") return { ok: false, error: "running" };

  await prisma.$transaction([
    prisma.dataServiceDataset.deleteMany({ where: { dataServiceId: svc.id } }),
    prisma.dataService.delete({ where: { id: svc.id } }),
    prisma.auditLog.create({ data: { workspaceId: session.workspaceId, actor: session.sub, action: "service.delete", target: svc.id, metadata: { code: svc.code, name: svc.name } } }),
  ]);

  revalidatePath("/service");
  revalidatePath("/service/publish");
  return { ok: true, id: svc.id };
}

export type PublishServiceResult =
  | { ok: true; warnings: QualityGateVerdict["warnings"] }
  | { ok: false; error: "unauthenticated" | "forbidden" | "not_found" | "tier" | "quality"; blockers?: QualityGateVerdict["blockers"] };

/**
 * Publish a data service (draft -> running) behind the quality gate (Q-BL2):
 * a critical-severity failing check on any linked dataset blocks the publish;
 * low scores and never-checked datasets warn but pass (recorded in audit).
 * Blocked attempts are audited too - a refused publish is a governance event.
 */
export async function publishDataService(serviceId: string): Promise<PublishServiceResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.services.publish_api")) return { ok: false, error: "tier" };

  const service = await prisma.dataService.findFirst({
    where: { workspaceId: session.workspaceId, id: serviceId },
  });
  if (!service) return { ok: false, error: "not_found" };
  if (service.status === "running") return { ok: true, warnings: [] }; // idempotent

  const verdict = await qualityGate(session.workspaceId, service.id);
  if (!verdict.allowed) {
    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "service.publish_blocked",
        target: service.id,
        metadata: { name: service.name, blockers: verdict.blockers },
      },
    });
    return { ok: false, error: "quality", blockers: verdict.blockers };
  }

  await prisma.$transaction([
    prisma.dataService.update({
      where: { id: service.id },
      data: { status: "running", publishedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "service.publish",
        target: service.id,
        metadata: { name: service.name, warnings: verdict.warnings },
      },
    }),
  ]);

  revalidatePath("/service");
  return { ok: true, warnings: verdict.warnings };
}
