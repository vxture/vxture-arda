import type { ReactNode } from "react";
import { Shell } from "../ui/shell";
import { getSession } from "../auth/lib/session";
import { prisma } from "../lib/db";
import { fillWorkspaceIfNeeded } from "../lib/seed-fill";

// Force every (app) route to render per request: the layout resolves the session
// and runs the first-entry seed, so it must execute on each gated entry rather
// than being prerendered once (which would skip the seed for a direct landing on
// an otherwise-static page like /etl or /lineage).
export const dynamic = "force-dynamic";

// Section group layout: every page under (app) renders inside the DS shell
// (header + left section nav + footer). Auth + entitlement gating happen above
// this, in the root layout.
//
// First-entry seed: on entry we resolve the caller's workspace and, if it is
// marked for seeding (or autofill is on for a never-seen workspace), fill it
// with the default template so the catalog is not empty. fillWorkspaceIfNeeded
// is best-effort and never throws; once the workspace is "done" this costs a
// single indexed WorkspaceRef lookup per navigation.
export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (session?.workspaceId) {
    await fillWorkspaceIfNeeded(prisma, session.workspaceId, session.tenantId);
  }
  return <Shell>{children}</Shell>;
}
