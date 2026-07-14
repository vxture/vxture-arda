"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { canUseFeature } from "../../entitlement/capability";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { prisma } from "../../lib/db";

export type TagActionResult = { ok: true } | { ok: false; error: "unauthenticated" | "forbidden" | "tier" | "invalid" };

/** Attach a tag to a dataset, creating the tag on first use (MD-BL3 curation;
 *  audited per MD-BL6). Everything workspace-scoped from the session. */
export async function attachTag(datasetId: string, name: string): Promise<TagActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.assets.edit_metadata")) return { ok: false, error: "tier" };

  const clean = name?.trim();
  if (!clean || clean.length > 60) return { ok: false, error: "invalid" };
  const dataset = await prisma.dataset.findFirst({ where: { workspaceId: session.workspaceId, id: datasetId } });
  if (!dataset) return { ok: false, error: "invalid" };

  await prisma.$transaction(async (tx) => {
    const tag = await tx.tag.upsert({
      where: { workspaceId_name: { workspaceId: session.workspaceId, name: clean } },
      create: { workspaceId: session.workspaceId, name: clean },
      update: {},
    });
    await tx.datasetTag.upsert({
      where: { datasetId_tagId: { datasetId: dataset.id, tagId: tag.id } },
      create: { workspaceId: session.workspaceId, datasetId: dataset.id, tagId: tag.id },
      update: {},
    });
    await tx.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "metadata.tag.attach",
        target: dataset.id,
        metadata: { dataset: dataset.name, tag: clean },
      },
    });
  });

  revalidatePath(`/catalog/${datasetId}`);
  return { ok: true };
}

/** Detach a tag from a dataset (the tag itself survives for reuse). */
export async function detachTag(datasetId: string, tagId: string): Promise<TagActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.assets.edit_metadata")) return { ok: false, error: "tier" };

  const link = await prisma.datasetTag.findFirst({
    where: { workspaceId: session.workspaceId, datasetId, tagId },
    include: { dataset: { select: { name: true } }, tag: { select: { name: true } } },
  });
  if (!link) return { ok: false, error: "invalid" };

  await prisma.$transaction([
    prisma.datasetTag.delete({ where: { datasetId_tagId: { datasetId, tagId } } }),
    prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "metadata.tag.detach",
        target: datasetId,
        metadata: { dataset: link.dataset.name, tag: link.tag.name },
      },
    }),
  ]);

  revalidatePath(`/catalog/${datasetId}`);
  return { ok: true };
}
