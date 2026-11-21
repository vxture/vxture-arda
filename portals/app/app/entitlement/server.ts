import { getProductSession as getSession, getPlatformUserContext } from "../auth/lib/session";
import { getEntitlementResolver } from "./resolver";
import type { Subscription } from "./types";
import { fetchPlatformEntitlement } from "./platform-client";
import { cache } from "react";

/** Server-side subscription lookup for layouts/pages (same resolution path as
 *  /api/entitlement; the platform resolver's short-TTL cache absorbs repeats). */
export const getSubscription = cache(async (): Promise<Subscription | null> => {
  const session = await getSession();
  if (!session) return null;
  if (process.env.NODE_ENV !== "production" && process.env.MOCK_AUTH === "true") {
    return getEntitlementResolver().resolve(session.ardaClaim, session.workspaceId);
  }
  return (await fetchPlatformEntitlement(session.workspaceId, await getPlatformUserContext(session))).subscription;
});
