/**
 * Cursor pagination for /api/v1 list endpoints.
 *
 * The cursor is an opaque base64url token wrapping the id of the last row of
 * the previous page. Reads use Prisma's native cursor pagination (`cursor` +
 * `skip: 1`) against a stable compound orderBy that ends on the unique id, so
 * pages stay consistent under concurrent inserts (no offset drift).
 */

export const LIMIT_DEFAULT = 20;
export const LIMIT_MAX = 100;

export function clampLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return LIMIT_DEFAULT;
  return Math.min(Math.floor(n), LIMIT_MAX);
}

export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), "utf8").toString("base64url");
}

/** Returns the cursor row id, or null when the token is malformed. */
export function decodeCursor(token: string): string | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      typeof (parsed as { id: unknown }).id === "string" &&
      (parsed as { id: string }).id.length > 0
    ) {
      return (parsed as { id: string }).id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Slice a limit+1 fetch into the page and its next cursor. Fetch callers ask
 * for `limit + 1` rows; the extra row only signals that another page exists.
 */
export function pageOf<T extends { id: string }>(rows: T[], limit: number): { data: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { data: rows, nextCursor: null };
  const data = rows.slice(0, limit);
  return { data, nextCursor: encodeCursor(data[data.length - 1].id) };
}
