import type { SessionUser } from "../api";
import { hasProductAccess, type Subscription } from "../../entitlement/types";

export function sessionScope(user: SessionUser): string {
  return JSON.stringify([user.sub, user.orgId, user.workspaceId, [...user.roles].sort(), user.accountStatus]);
}

export function accessState(subscription: Subscription, user: SessionUser): "connected" | "subscription" | "expired" | "unassigned" | "access-unavailable" {
  if (!user.workspaceId) return "access-unavailable";
  if (!hasProductAccess(subscription)) {
    if (subscription.statusKnown === false) return "access-unavailable";
    if (subscription.status === null) return "subscription";
    if (subscription.status === "expired" || subscription.status === "cancelled") return "expired";
    // An operational freeze or unknown status is not a purchase opportunity.
    return "access-unavailable";
  }
  // Product assignment denial is not a missing Arda business role or a renewal prompt.
  if (subscription.productAssigned !== true) return "access-unavailable";
  // Platform-admitted users have baseline member use. Governance roles only
  // elevate management; do not manufacture claims or require a second grant.
  return "connected";
}
