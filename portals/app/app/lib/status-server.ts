import { getSession } from "../auth/lib/session";
import { checkDependencies } from "./readiness";
import { createStatusReader, statusMode } from "./status";

// Next.js can bundle the page and API as separate entry points within one process.
const processCache = globalThis as typeof globalThis & { ardaStatusReader?: ReturnType<typeof createStatusReader> };
export const readStatus = processCache.ardaStatusReader ??= createStatusReader(checkDependencies);

export async function statusAccess() {
  const mode = statusMode(process.env);
  if (mode === "off") return 404;
  if (mode === "authed" && !(await getSession().catch(() => null))) return 401;
  return 200;
}
