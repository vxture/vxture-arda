import type { SessionUser } from "../api";
import { hasProductAccess, type Subscription } from "../../entitlement/types";

/** Existing Arda role vocabulary; org membership alone is not a usage role. */
const USAGE_ROLES = ["org:owner", "workspace:owner", "workspace:manager", "workspace:member", "workspace:readonly", "workspace:guest"];

export function sessionScope(user: SessionUser): string {
  return JSON.stringify([user.sub, user.orgId, user.workspaceId, [...user.roles].sort()]);
}

export function accessState(subscription: Subscription, user: SessionUser): "connected" | "subscription" | "expired" | "unassigned" | "access-unavailable" {
  if (!user.workspaceId) return "access-unavailable";
  if (subscription.status === null) return "subscription";
  if (subscription.status === "expired" || subscription.status === "cancelled") return "expired";
  // An operational freeze is not a purchase opportunity.
  if (!hasProductAccess(subscription)) return "access-unavailable";
  if (!user.roles.some(role => USAGE_ROLES.includes(role.trim().toLowerCase()))) return "unassigned";
  return "connected";
}
