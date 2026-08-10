import type { NextRequest } from "next/server";

/**
 * Idempotency-Key support for /api/v1 write endpoints (arda_data_180; storage
 * semantics data-140 2.1). Agent callers retry as a matter of course, so every
 * POST accepts an optional `Idempotency-Key` header:
 *
 *   - The creating transaction writes its audit row WITH the (namespaced) key;
 *     `AuditLog.idempotencyKey @unique` is the storage-level replay guard.
 *   - A replayed request hits the unique violation, resolves the original
 *     audit row, and returns the originally created resource (200 +
 *     `idempotency-replayed: true`) instead of creating a duplicate.
 *   - Reusing a key for a DIFFERENT action (or after the resource vanished)
 *     is a 409 `idempotency_conflict`.
 *
 * Client keys are namespaced per workspace ("api:<ws>:<key>") before storage:
 * the column is globally unique, but idempotency is a per-caller contract -
 * two workspaces choosing the same key must not collide.
 */

const HEADER = "idempotency-key";
const KEY_PATTERN = /^[\x21-\x7e]{1,180}$/; // printable ASCII, no spaces

export type IdempotencyHeader = { key: string | null } | { invalid: true };

export function readIdempotencyKey(req: NextRequest): IdempotencyHeader {
  const raw = req.headers.get(HEADER);
  if (raw === null) return { key: null };
  if (!KEY_PATTERN.test(raw)) return { invalid: true };
  return { key: raw };
}

export function storedIdempotencyKey(workspaceId: string, clientKey: string): string {
  return `api:${workspaceId}:${clientKey}`;
}

/** P2002 unique-violation check narrowed to a constraint containing `field`. */
export function isUniqueViolation(e: unknown, field: string): boolean {
  const err = e as { code?: string; meta?: { target?: unknown } };
  return err?.code === "P2002" && String(err.meta?.target ?? "").includes(field);
}

export type IdempotentOutcome<T> =
  | { kind: "created"; value: T }
  | { kind: "replayed"; value: T }
  | { kind: "conflict" };

/**
 * Run a create under the idempotency contract. `create` must persist the
 * resource AND its audit row (carrying `storedKey`) in one transaction;
 * `replayFetch` maps the original audit row's target back to a response body.
 */
export async function runIdempotentCreate<T>(
  opts: { storedKey: string | null; action: string },
  create: () => Promise<T>,
  replayFetch: (targetId: string) => Promise<T | null>,
): Promise<IdempotentOutcome<T>> {
  if (!opts.storedKey) return { kind: "created", value: await create() };
  try {
    return { kind: "created", value: await create() };
  } catch (e) {
    if (!isUniqueViolation(e, "idempotencyKey")) throw e;
    // Lazy import keeps this module loadable without a database (unit tests).
    const { prisma } = await import("../db");
    const original = await prisma.auditLog.findUnique({ where: { idempotencyKey: opts.storedKey } });
    if (!original || original.action !== opts.action || !original.target) return { kind: "conflict" };
    const value = await replayFetch(original.target);
    if (value === null) return { kind: "conflict" };
    return { kind: "replayed", value };
  }
}
