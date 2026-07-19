"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../../auth/lib/session";
import { prisma } from "../../../lib/db";

/**
 * Submit a data access / sharing request (Sec-BL4). Any authenticated
 * workspace member may request access to an asset; the request lands in the
 * admin approval center as `pending`. Approval/decision lives in
 * app/(app)/approvals.
 */
export type AccessRequestResult = { ok: true } | { ok: false; error: "unauthenticated" | "invalid" | "not_found" };

export interface AccessRequestInput {
  datasetId: string;
  useCase: string;
  scope: string | null;
  justification: string;
  duration: string | null;
  method: string | null;
}

export async function submitAccessRequest(input: AccessRequestInput): Promise<AccessRequestResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };

  const useCase = input.useCase.trim();
  const justification = input.justification.trim();
  if (!useCase || useCase.length > 200 || !justification || justification.length > 1000) return { ok: false, error: "invalid" };

  const ds = await prisma.dataset.findFirst({
    where: { workspaceId: session.workspaceId, id: input.datasetId },
    select: { id: true, name: true },
  });
  if (!ds) return { ok: false, error: "not_found" };

  await prisma.$transaction(async (tx) => {
    const row = await tx.accessRequest.create({
      data: {
        workspaceId: session.workspaceId,
        datasetId: ds.id,
        requesterSub: session.sub,
        requesterName: session.displayName ?? session.username ?? null,
        useCase,
        scope: input.scope?.trim() || null,
        justification,
        duration: input.duration?.trim() || null,
        method: input.method?.trim() || null,
        status: "pending",
      },
    });
    await tx.auditLog.create({
      data: { workspaceId: session.workspaceId, actor: session.sub, action: "access.request.submit", target: row.id, metadata: { dataset: ds.name, useCase } },
    });
  });

  revalidatePath("/approvals");
  return { ok: true };
}
