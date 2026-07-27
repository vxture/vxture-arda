/**
 * arda Curator - types (skeleton only, ADR-013 / arda-biz-270).
 *
 * "Curator" is arda's own in-house data-management capability. It is NOT the
 * same concept as the "agent" used throughout arda-data-150/170 (an external
 * product like karda that consumes arda's data via DataService/ApiKey) - the
 * Curator lives inside arda and acts on arda's own catalog/glossary/quality
 * data, on behalf of arda's own logged-in user.
 *
 * Unlike karda's tool surface (called by external S2S agents, so it resolves
 * a CallerContext from a verified inbound S2S token, see kb/tools/s2s.ts),
 * the Curator is invoked from arda's own UI by arda's own signed-in user - so
 * its context is arda's existing session identity + active workspace
 * (resolveIdentity() in ../auth/lib/session.ts), not a separate auth flow.
 */
import type { IdentityClaims } from "../auth/lib/session-store";
import type { CuratorAccess } from "../entitlement/capability";

export interface CuratorContext {
  /** arda's own resolved user identity (from the existing session cookie). */
  user: Pick<IdentityClaims, "sub" | "active_workspace">;
  /** Tier-derived enabled/readonly gate (entitlement/capability.ts). */
  access: CuratorAccess;
}
