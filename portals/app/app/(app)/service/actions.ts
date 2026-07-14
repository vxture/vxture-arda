"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { canUseFeature } from "../../entitlement/capability";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { prisma } from "../../lib/db";
import { qualityGate, type QualityGateVerdict } from "./quality-gate";

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
