import type { PlatformContext } from "./ticket";
import { productAssigned } from "./access";
import { fetchPlatformEntitlement } from "../entitlement/platform-client";
import { hasProductAccess } from "../entitlement/types";

/** Both user assignment and effective commercial coverage precede business data. */
export async function admitProductUser(context: PlatformContext, deps = {
  assigned: productAssigned, entitlement: fetchPlatformEntitlement,
}): Promise<boolean> {
  if (!await deps.assigned(context)) return false;
  const { subscription } = await deps.entitlement(context.workspaceId, context);
  return hasProductAccess(subscription);
}
