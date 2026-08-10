import type { Prisma, PrismaClient } from "../../generated/prisma/client";

/**
 * Single audit write point (data-140 2.2). Call inside the same transaction
 * as the side effect it records, passing the transaction client; the dotted
 * action vocabulary (e.g. "catalog.dataset.register") stays free-form per SoT.
 *
 * Returns the underlying PrismaPromise (not wrapped in an async function) so
 * it composes with BOTH transaction forms: `$transaction(async tx => ...)`
 * and the array form `$transaction([op, writeAudit(prisma, ...)])`, which
 * only accepts PrismaPromises.
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

export function writeAudit(db: Prisma.TransactionClient | PrismaClient, entry: AuditEntry) {
  return db.auditLog.create({
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
