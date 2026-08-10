import type { Prisma } from "../../generated/prisma/client";

/**
 * Single audit write point (data-140 2.2). Call inside the same transaction
 * as the side effect it records, passing the transaction client; the dotted
 * action vocabulary (e.g. "catalog.dataset.register") stays free-form per SoT.
 *
 * `idempotencyKey` is globally unique (data-140 2.1): pass it to make the
 * audit row double as the storage-level replay guard - the unique violation
 * on a second write is the idempotent short-circuit signal.
 */

export interface AuditEntry {
  workspaceId: string;
  /** User sub, "platform", or "apikey:<consumerApp|name>" for API callers. */
  actor: string;
  action: string;
  target?: string | null;
  metadata?: Prisma.InputJsonValue;
  idempotencyKey?: string;
}

export async function writeAudit(db: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      workspaceId: entry.workspaceId,
      actor: entry.actor,
      action: entry.action,
      target: entry.target ?? null,
      metadata: entry.metadata,
      idempotencyKey: entry.idempotencyKey,
    },
  });
}
