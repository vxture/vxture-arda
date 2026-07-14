"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "../../auth/lib/session";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { prisma } from "../../lib/db";

/**
 * Revoke an API key. Server action: never trust the client - the session,
 * role, and workspace scope are all re-checked here (three-layer defense,
 * action layer). Revocation is a soft flag (`revoked=true`), never a delete,
 * and writes an AuditLog row (biz-250 §7.3 - one of the first real audit
 * write points).
 */
export async function revokeApiKey(keyId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  // Workspace-scoped compound filter: a key id from another workspace never matches.
  const key = await prisma.apiKey.findFirst({ where: { workspaceId: session.workspaceId, id: keyId } });
  if (!key) return { ok: false, error: "not_found" };
  if (key.revoked) return { ok: true }; // idempotent

  await prisma.$transaction([
    prisma.apiKey.update({ where: { id: key.id }, data: { revoked: true } }),
    prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "apikey.revoke",
        target: key.id,
        metadata: { name: key.name, consumerApp: key.consumerApp },
      },
    }),
  ]);

  revalidatePath("/apikeys");
  return { ok: true };
}

export type CreateKeyResult =
  | { ok: true; token: string; id: string }
  | { ok: false; error: "unauthenticated" | "forbidden" | "invalid" };

/**
 * Mint an API key (biz-250 §5): the plaintext token is returned EXACTLY ONCE
 * and only its sha256 hash is stored (data-130 §2.2). Optionally bound to one
 * data service (the gateway enforces the binding).
 */
export async function createApiKey(input: { name: string; dataServiceId?: string | null }): Promise<CreateKeyResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!isWorkspaceAdmin(session.roles)) return { ok: false, error: "forbidden" };

  const name = input.name?.trim();
  if (!name || name.length > 120) return { ok: false, error: "invalid" };

  let dataServiceId: string | null = null;
  if (input.dataServiceId) {
    const svc = await prisma.dataService.findFirst({
      where: { workspaceId: session.workspaceId, id: input.dataServiceId },
      select: { id: true },
    });
    if (!svc) return { ok: false, error: "invalid" };
    dataServiceId = svc.id;
  }

  const { randomBytes, createHash } = await import("node:crypto");
  const token = "ak_live_" + randomBytes(24).toString("base64url");
  const hashedKey = createHash("sha256").update(token).digest("hex");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.apiKey.create({
      data: { workspaceId: session.workspaceId, name, dataServiceId, hashedKey, scopes: [] },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        actor: session.sub,
        action: "apikey.create",
        target: row.id,
        metadata: { name, dataServiceId },
      },
    });
    return row;
  });

  revalidatePath("/apikeys");
  return { ok: true, token, id: created.id };
}
