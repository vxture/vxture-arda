import { getSession } from "../../auth/lib/session";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { getGlossary } from "./data";
import { GlossaryList } from "./glossary-list";

// Server component: workspace terms + the platform read-only overlay.
export const dynamic = "force-dynamic";

export default async function GlossaryPage() {
  const session = await getSession();
  const terms = session ? await getGlossary(session.workspaceId) : [];
  return <GlossaryList terms={terms} isAdmin={isWorkspaceAdmin(session?.roles)} />;
}
