import type { ReactNode } from "react";
import { Shell } from "../ui/shell";
import { AccountGate } from "../ui/account-gate";
import { EntitlementGate } from "../entitlement/gate";
import { getSession, getProductSession } from "../auth/lib/session";
import { permits, isProductManager } from "../authz/policy";
import { getWipeState } from "../lib/workspace-state";
import { WipedNotice } from "../lifecycle/wiped-notice";
import { prisma } from "../lib/db";
import { fillWorkspaceIfNeeded } from "../lib/seed-fill";

// Force every (app) route to render per request: the layout resolves the session
// and runs the first-entry seed, so it must execute on each gated entry rather
// than being prerendered once (which would skip the seed for a direct landing on
// an otherwise-static page like /etl or /lineage).
export const dynamic = "force-dynamic";

// Section group layout: every page under (app) renders inside the DS shell
// (header + left section nav + footer). Entry gating (AccountGate then
// EntitlementGate) also lives here, scoped to this group only - the sibling
// (demo) group (status, entitlement-matrix) is intentionally public.
//
// First-entry seed: on entry we resolve the caller's workspace and, if it is
// marked for seeding (or autofill is on for a never-seen workspace), fill it
// with the default template so the catalog is not empty. fillWorkspaceIfNeeded
// is best-effort and never throws; once the workspace is "done" this costs a
// single indexed WorkspaceRef lookup per navigation.
export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const admittedAccess = (await getProductSession())?.productAccess;

  // Wipe chokepoint (Lc-BL3): a workspace carrying the soft-delete mark shows
  // nothing - one anchor lookup replaces per-row deletedAt filters everywhere.
  if (session?.workspaceId) {
    const wipe = await getWipeState(session.workspaceId);
    if (wipe.wiped) {
      return (
        <AccountGate>
          <Shell isAdmin={false}>
            <WipedNotice retainedUntil={wipe.retainedUntil?.toISOString() ?? null} />
          </Shell>
        </AccountGate>
      );
    }
    const admitted = await getProductSession();
    if (admitted && permits(admitted.productAccess,"data.write")) await fillWorkspaceIfNeeded(prisma, admitted.workspaceId, admitted.tenantId);
  }
  // Role axis for the chrome: hides role-locked nav/boards (admin). Screen
  // content is enforced separately server-side (ScreenGate) - hiding is UX,
  // not the security boundary.
  return (
    <AccountGate>
      <EntitlementGate>
        <Shell isAdmin={isProductManager(admittedAccess)}>{children}</Shell>
      </EntitlementGate>
    </AccountGate>
  );
}
