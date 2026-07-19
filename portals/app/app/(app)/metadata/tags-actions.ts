"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { canUseFeature } from "../../entitlement/capability";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { prisma } from "../../lib/db";

/**
 * Tag management writes (biz-422 MD-BL3). Business-metadata curation gates on
 * arda.assets.edit_metadata (starter) + workspace-admin role, mirroring the
 * quality/security write actions; every mutation lands an AuditLog row.
 */
export type TagActionResult =
  | { ok: true }
  | { ok: false; error: "unauthenticated" | "forbidden" | "tier" | "invalid" | "duplicate" };

async function authorize(): Promise<{ ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> } | { ok: false; error: "unauthenticated" | "forbidden" | "tier" }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };
  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.assets.edit_metadata")) return { ok: false, error: "tier" };
  return { ok: true, session };
}

export async function createTag(nameRaw: string): Promise<TagActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const { session } = auth;

  const name = nameRaw.trim();
  if (!name || name.length > 60) return { ok: false, error: "invalid" };

  const exists = await prisma.tag.findFirst({ where: { workspaceId: session.workspaceId, name } });
  if (exists) return { ok: false, error: "duplicate" };

  await prisma.$transaction(async (tx) => {
    const tag = await tx.tag.create({ data: { workspaceId: session.workspaceId, name } });
    await tx.auditLog.create({
      data: { workspaceId: session.workspaceId, actor: session.sub, action: "metadata.tag.create", target: tag.id, metadata: { name } },
    });
  });

  revalidatePath("/metadata/tags");
  return { ok: true };
}

export async function deleteTag(tagId: string): Promise<TagActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const { session } = auth;

  const tag = await prisma.tag.findFirst({ where: { workspaceId: session.workspaceId, id: tagId } });
  if (!tag) return { ok: false, error: "invalid" };

  // DatasetTag rows cascade (schema onDelete: Cascade).
  await prisma.$transaction([
    prisma.tag.delete({ where: { id: tag.id } }),
    prisma.auditLog.create({
      data: { workspaceId: session.workspaceId, actor: session.sub, action: "metadata.tag.delete", target: tag.id, metadata: { name: tag.name } },
    }),
  ]);

  revalidatePath("/metadata/tags");
  return { ok: true };
}
