import type { AccessEvent } from "./protocol";

/** Invalidations carry versions, not authorization. Reconnect can force resync. */
export class AccessCursor {
  private revision: string | undefined;
  private context: string | undefined;
  accept(event: Exclude<AccessEvent, { type: "revoked" }>): boolean {
    if (event.type === "changed" && this.context === event.context && this.revision !== undefined
      && BigInt(event.revision) <= BigInt(this.revision)) return false;
    const changed = this.revision !== event.revision || this.context !== event.context;
    this.revision = event.revision; this.context = event.context;
    return changed;
  }
}

/** Keep one read in flight and one trailing read for changes during that read. */
export function accessSynchronizer(check: () => Promise<unknown>, alive: () => boolean) {
  let pending: Promise<void> | null = null;
  let dirty = false;
  return () => {
    dirty = true;
    if (pending) return pending;
    pending = (async () => {
      while (dirty && alive()) { dirty = false; await check(); }
    })().finally(() => { pending = null; });
    return pending;
  };
}
