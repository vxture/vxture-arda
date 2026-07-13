import { getSession } from "../auth/lib/session";
import { getEntitlementResolver } from "./resolver";
import type { Subscription } from "./types";

/** Server-side subscription lookup for layouts/pages (same resolution path as
 *  /api/entitlement; the platform resolver's short-TTL cache absorbs repeats). */
export async function getSubscription(): Promise<Subscription | null> {
  const session = await getSession();
  if (!session) return null;
  return getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
}
