import type { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { clampLimit, decodeCursor } from "./pagination";
import { problem } from "./problem";

/**
 * Query-string validation for /api/v1 route handlers. Schemas are zod objects
 * over the raw searchParams record; a failed parse becomes a 400 problem with
 * every issue listed (never a silent default).
 */

export type ParsedQuery<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

export function parseQuery<Schema extends z.ZodType>(
  req: NextRequest,
  schema: Schema,
): ParsedQuery<z.infer<Schema>> {
  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
      .join("; ");
    return { ok: false, response: problem(400, "invalid_parameter", detail) };
  }
  return { ok: true, value: result.data };
}

/** Resolve the shared limit/cursor pair every list endpoint accepts. */
export function parsePage(value: {
  limit?: string;
  cursor?: string;
}): { ok: true; limit: number; cursorId?: string } | { ok: false; response: NextResponse } {
  const limit = clampLimit(value.limit ?? null);
  if (value.cursor === undefined) return { ok: true, limit };
  const cursorId = decodeCursor(value.cursor);
  if (!cursorId) return { ok: false, response: problem(400, "invalid_cursor") };
  return { ok: true, limit, cursorId };
}
