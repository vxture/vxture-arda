/** Short-lived C2 cache. Expired authority is never reused after a transport failure. */
import type { EntitlementResolver } from "./resolver";
import type { Subscription, ArdaClaim } from "./types";
import type { WorkspaceQuota } from "./quota";
import { fetchPlatformEntitlement, type PlatformEntitlementResult } from "./platform-client";

const TTL_MS = 45_000;
interface CacheEntry extends PlatformEntitlementResult { expiresAt: number; generation: number; revision: string }
async function sharedRevision(workspaceId: string): Promise<string> {
  const { getEventBus } = await import("../events/bus");
  return getEventBus().version(workspaceId);
}

export class PlatformEntitlementResolver implements EntitlementResolver {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly generations = new Map<string, number>();
  constructor(private read = fetchPlatformEntitlement, private now = Date.now,
    private revision = read === fetchPlatformEntitlement ? sharedRevision : async (_workspaceId: string) => "0") {}

  async resolve(_claim: ArdaClaim | null, workspaceId?: string): Promise<Subscription> {
    return (await this.fetch(workspaceId)).subscription;
  }
  async resolveQuota(workspaceId?: string): Promise<WorkspaceQuota> {
    return (await this.fetch(workspaceId)).quota;
  }
  async resolveFresh(_claim: ArdaClaim | null, workspaceId?: string): Promise<Subscription> {
    return (await this.fetch(workspaceId, true)).subscription;
  }
  invalidateCache(workspaceId: string): void {
    this.cache.delete(workspaceId);
    this.generations.set(workspaceId, (this.generations.get(workspaceId) ?? 0) + 1);
  }
  private async fetch(workspaceId?: string, fresh = false): Promise<PlatformEntitlementResult> {
    if (!workspaceId) throw new Error("workspace required");
    const generation = this.generations.get(workspaceId) ?? 0;
    const revision = await this.revision(workspaceId);
    const cached = this.cache.get(workspaceId);
    if (!fresh && cached && cached.generation === generation && cached.revision === revision && cached.expiresAt > this.now()) return cached;
    const value = await this.read(workspaceId);
    if ((this.generations.get(workspaceId) ?? 0) !== generation || await this.revision(workspaceId) !== revision) throw new Error("entitlement_changed_during_read");
    if (this.cache.size >= 512) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(workspaceId, { ...value, generation, revision, expiresAt: this.now() + TTL_MS });
    return value;
  }
}
