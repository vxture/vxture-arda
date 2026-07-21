"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { canUseFeature } from "../../entitlement/capability";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getEntitlementResolver } from "../../entitlement/resolver";
import { prisma } from "../../lib/db";

export type CreateTermResult =
  | { ok: true; id: string }
  | { ok: false; error: "unauthenticated" | "forbidden" | "tier" | "invalid" | "duplicate" };

/**
 * Create a workspace glossary term (MD-BL3 curation). Writes are always
 * tenant-local: the platform overlay rows (workspaceId NULL) are ops-only and
 * unreachable from here by construction (workspaceId comes from the session).
 * Audited (MD-BL6 metadata-change audit point).
 */
export async function createGlossaryTerm(input: { term: string; definition: string }): Promise<CreateTermResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const subscription = await getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  if (!canUseFeature(subscription, "arda.assets.glossary")) return { ok: false, error: "tier" };

  const term = input.term?.trim();
  const definition = input.definition?.trim();
  if (!term || term.length > 120 || !definition || definition.length > 2000) return { ok: false, error: "invalid" };

  const existing = await prisma.glossaryTerm.findFirst({ where: { workspaceId: session.workspaceId, term } });
  if (existing) return { ok: false, error: "duplicate" };

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.glossaryTerm.create({
      data: { workspaceId: session.workspaceId, term, definition, stewardUserId: session.sub },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "glossary.term.create",
        target: row.id,
        metadata: { term },
      },
    });
    return row;
  });

  revalidatePath("/glossary");
  return { ok: true, id: created.id };
}
