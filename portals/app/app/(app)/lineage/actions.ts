"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { canUseFeature } from "../../entitlement/capability";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { prisma } from "../../lib/db";
import { wouldCreateCycle } from "./graph-core";
import { writeAudit } from "../../lib/audit";

export type AddEdgeResult =
  | { ok: true }
  | { ok: false; error: "unauthenticated" | "forbidden" | "tier" | "invalid" | "cycle" | "duplicate" };

/**
 * Manually record a dataset-level lineage edge (L-BL2 v1: manual entry first;
 * automated collection rides pipelines later). Cycles are rejected - lineage
 * is a DAG by definition - and the write is audited (L-BL4).
 */
export async function addLineageEdge(input: {
  upstreamDatasetId: string;
  downstreamDatasetId: string;
  transform?: string;
}): Promise<AddEdgeResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.governance.lineage")) return { ok: false, error: "tier" };

  const { upstreamDatasetId: up, downstreamDatasetId: down } = input;
  if (!up || !down || up === down) return { ok: false, error: "invalid" };

  // Both endpoints must exist in THIS workspace (compound filter).
  const endpoints = await prisma.dataset.findMany({
    where: { workspaceId: session.workspaceId, id: { in: [up, down] } },
    select: { id: true, name: true },
  });
  if (endpoints.length !== 2) return { ok: false, error: "invalid" };

  const existing = await prisma.lineageEdge.findMany({
    where: { workspaceId: session.workspaceId },
    select: { upstreamDatasetId: true, downstreamDatasetId: true },
  });
  if (existing.some((e) => e.upstreamDatasetId === up && e.downstreamDatasetId === down)) {
    return { ok: false, error: "duplicate" };
  }
  if (wouldCreateCycle(up, down, existing.map((e) => ({ from: e.upstreamDatasetId, to: e.downstreamDatasetId })))) {
    return { ok: false, error: "cycle" };
  }

  const transform = input.transform?.trim() || null;
  await prisma.$transaction([
    prisma.lineageEdge.create({
      data: { workspaceId: session.workspaceId, upstreamDatasetId: up, downstreamDatasetId: down, transform },
    }),
    writeAudit(prisma, {
      workspaceId: session.workspaceId,
      actor: session.sub,
      action: "lineage.change",
      target: `${up}->${down}`,
      metadata: {
        upstream: endpoints.find((e) => e.id === up)?.name,
        downstream: endpoints.find((e) => e.id === down)?.name,
        transform,
      },
    }),
  ]);

  revalidatePath("/lineage");
  return { ok: true };
}
