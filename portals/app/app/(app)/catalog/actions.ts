"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { canUseFeature } from "../../entitlement/capability";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { prisma } from "../../lib/db";
import type { AssetLevel } from "./seed";

export type TagActionResult = { ok: true } | { ok: false; error: "unauthenticated" | "forbidden" | "tier" | "invalid" };

const ASSET_LEVELS: readonly AssetLevel[] = ["public", "internal", "sensitive", "core"];

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

/** Toggle the golden-record mark (M-BL1, gated arda.governance.master_data). */
export async function setGoldenRecord(datasetId: string, golden: boolean): Promise<TagActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.governance.master_data")) return { ok: false, error: "tier" };

  const dataset = await prisma.dataset.findFirst({ where: { workspaceId: session.workspaceId, id: datasetId } });
  if (!dataset) return { ok: false, error: "invalid" };

  await prisma.$transaction([
    prisma.dataset.update({ where: { id: dataset.id }, data: { goldenRecord: golden } }),
    prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: golden ? "master_data.golden.mark" : "master_data.golden.unmark",
        target: dataset.id,
        metadata: { dataset: dataset.name },
      },
    }),
  ]);
  revalidatePath(`/catalog/${datasetId}`);
  revalidatePath("/catalog");
  revalidatePath("/masterdata");
  return { ok: true };
}

/** Change a dataset's classification level (Sec-BL2 input, gated
 *  arda.governance.classification). */
export async function setDatasetClassification(datasetId: string, level: string): Promise<TagActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.governance.classification")) return { ok: false, error: "tier" };

  if (!ASSET_LEVELS.includes(level as AssetLevel)) return { ok: false, error: "invalid" };
  const newLevel = level as AssetLevel;

  const dataset = await prisma.dataset.findFirst({ where: { workspaceId: session.workspaceId, id: datasetId } });
  if (!dataset) return { ok: false, error: "invalid" };
  if (dataset.classification === newLevel) return { ok: true };

  await prisma.$transaction([
    prisma.dataset.update({ where: { id: dataset.id }, data: { classification: newLevel } }),
    prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "security.classification.set",
        target: dataset.id,
        metadata: { dataset: dataset.name, from: dataset.classification, to: newLevel },
      },
    }),
  ]);
  revalidatePath(`/catalog/${datasetId}`);
  revalidatePath("/catalog");
  revalidatePath("/security");
  return { ok: true };
}

/** Link a standard to a dataset (S-BL1, gated arda.governance.standards).
 *  Platform-scope standards are linkable (read-only overlay reference). */
export async function attachStandard(datasetId: string, standardId: string): Promise<TagActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.governance.standards")) return { ok: false, error: "tier" };

  const [dataset, standard] = await Promise.all([
    prisma.dataset.findFirst({ where: { workspaceId: session.workspaceId, id: datasetId } }),
    prisma.standard.findFirst({
      where: { workspaceId: { in: [session.workspaceId, "__platform__"] }, id: standardId },
    }),
  ]);
  if (!dataset || !standard) return { ok: false, error: "invalid" };

  await prisma.$transaction(async (tx) => {
    await tx.datasetStandard.upsert({
      where: { datasetId_standardId: { datasetId: dataset.id, standardId: standard.id } },
      create: { workspaceId: session.workspaceId, datasetId: dataset.id, standardId: standard.id },
      update: {},
    });
    await tx.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "standard.compliance.link",
        target: dataset.id,
        metadata: { dataset: dataset.name, standard: standard.name },
      },
    });
  });
  revalidatePath(`/catalog/${datasetId}`);
  return { ok: true };
}

/** Unlink a standard from a dataset. */
export async function detachStandard(datasetId: string, standardId: string): Promise<TagActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.governance.standards")) return { ok: false, error: "tier" };

  const link = await prisma.datasetStandard.findFirst({
    where: { workspaceId: session.workspaceId, datasetId, standardId },
    include: { dataset: { select: { name: true } }, standard: { select: { name: true } } },
  });
  if (!link) return { ok: false, error: "invalid" };

  await prisma.$transaction([
    prisma.datasetStandard.delete({ where: { datasetId_standardId: { datasetId, standardId } } }),
    prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "standard.compliance.unlink",
        target: datasetId,
        metadata: { dataset: link.dataset.name, standard: link.standard.name },
      },
    }),
  ]);
  revalidatePath(`/catalog/${datasetId}`);
  return { ok: true };
}
