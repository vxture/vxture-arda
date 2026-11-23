import { platformRequest } from "./client";
import type { PlatformContext } from "./ticket";

const PRODUCT = "arda";
const SUBJECT = /^usr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export interface AuthorizedMember { subject: string; display_name: string | null; eligible: true }
export interface AuthorizedRoster {
  org_id: string; workspace_id: string; product: string;
  authorization_mode: "assigned_seats"; version: string; items: AuthorizedMember[];
}
class RosterChanged extends Error {}

/** Read a complete live snapshot, never a cached list of historical local roles.
 * Browser requests use product-access. Received OBO tickets use this current
 * eligible roster through workspace service tickets (RP re-exchange is invalid).
 * No snapshot is reused as a permanent allow-list; no roles/seats are written. */
export async function authorizedRoster(context: PlatformContext,
  request: typeof platformRequest = platformRequest): Promise<AuthorizedRoster> {
  if (!context.orgId || !context.workspaceId) throw new Error("roster_context_required");
  const deadline = Date.now() + 30000;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const items: AuthorizedMember[] = [];
      const subjects = new Set<string>();
      const cursors = new Set<string>();
      let cursor: string | null = null;
      let version: string | undefined;
      for (let page = 0; page < 100; page++) {
        if (Date.now() >= deadline) throw new Error("roster_read_budget");
        const query = new URLSearchParams({ limit: "200" });
        if (cursor) query.set("cursor", cursor);
        const response = await request(`/platform/product-roster?${query}`, context);
        if (response.status === 409) throw new RosterChanged("roster_changed");
        if (!response.ok) throw new Error(`roster_${response.status}`);
        const value = await response.json();
        if (!value || value.org_id !== context.orgId || value.workspace_id !== context.workspaceId
          || value.product !== PRODUCT || value.authorization_mode !== "assigned_seats"
          || typeof value.version !== "string" || !/^[0-9a-f]{32}$/.test(value.version)
          || !Array.isArray(value.items) || value.items.length > 200
          || !Object.hasOwn(value, "nextCursor")
          || value.nextCursor !== null && (typeof value.nextCursor !== "string"
            || !/^[A-Za-z0-9_-]{1,1024}$/.test(value.nextCursor))) throw new Error("roster_invalid");
        if (version !== undefined && version !== value.version) throw new RosterChanged("roster_changed");
        version = value.version;
        for (const item of value.items) {
          if (!item || typeof item.subject !== "string" || !SUBJECT.test(item.subject)
            || item.eligible !== true || subjects.has(item.subject)
            || item.display_name !== null && (typeof item.display_name !== "string"
              || !item.display_name.trim() || item.display_name.length > 500
              || /[\x00-\x1f]/.test(item.display_name))) throw new Error("roster_invalid_member");
          subjects.add(item.subject);
          items.push({ subject: item.subject, display_name: item.display_name, eligible: true });
        }
        if (value.nextCursor === null) return { org_id: context.orgId, workspace_id: context.workspaceId,
          product: PRODUCT, authorization_mode: "assigned_seats", version: version!, items };
        if (!value.items.length || cursors.has(value.nextCursor)) throw new Error("roster_cursor_loop");
        cursors.add(value.nextCursor); cursor = value.nextCursor;
      }
      throw new Error("roster_page_budget");
    } catch (error) {
      if (!(error instanceof RosterChanged) || attempt === 1) throw error;
    }
  }
  throw new Error("roster_unavailable");
}
