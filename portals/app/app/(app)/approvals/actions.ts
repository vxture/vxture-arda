"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { prisma } from "../../lib/db";

/**
 * Approval decisions (Sec-BL4). Approve/reject is workspace-admin only; a
 * requester may cancel their own still-pending request. Every transition lands
 * an AuditLog row. Only pending requests transition (idempotent guard).
 */
export type DecisionResult = { ok: true } | { ok: false; error: "unauthenticated" | "forbidden" | "not_found" | "not_pending" };

export async function decideRequest(id: string, approve: boolean, note?: string): Promise<DecisionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const req = await prisma.accessRequest.findFirst({ where: { workspaceId: session.workspaceId, id } });
  if (!req) return { ok: false, error: "not_found" };
  if (req.status !== "pending") return { ok: false, error: "not_pending" };

  const status = approve ? "approved" : "rejected";
  const decisionNote = note?.trim() ? note.trim().slice(0, 500) : null;

  await prisma.$transaction([
    prisma.accessRequest.update({
      where: { id: req.id },
      data: { status, decidedBy: session.sub, decidedAt: new Date(), decisionNote },
    }),
    prisma.auditLog.create({
      data: { workspaceId: session.workspaceId, actor: session.sub, action: approve ? "access.request.approve" : "access.request.reject", target: req.id, metadata: { requester: req.requesterName ?? req.requesterSub, useCase: req.useCase } },
    }),
  ]);

  revalidatePath("/approvals");
  return { ok: true };
}

/** Requester withdraws their own still-pending request. */
export async function cancelRequest(id: string): Promise<DecisionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };

  const req = await prisma.accessRequest.findFirst({ where: { workspaceId: session.workspaceId, id } });
  if (!req) return { ok: false, error: "not_found" };
  if (req.requesterSub !== session.sub) return { ok: false, error: "forbidden" };
  if (req.status !== "pending") return { ok: false, error: "not_pending" };

  await prisma.$transaction([
    prisma.accessRequest.update({ where: { id: req.id }, data: { status: "cancelled", decidedAt: new Date() } }),
    prisma.auditLog.create({
      data: { workspaceId: session.workspaceId, actor: session.sub, action: "access.request.cancel", target: req.id, metadata: { useCase: req.useCase } },
    }),
  ]);

  revalidatePath("/approvals");
  return { ok: true };
}
