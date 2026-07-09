/**
 * PlatformEntitlementResolver: calls GET /platform/entitlements (C2) with a
 * 45-second in-memory TTL cache per workspaceId (matching the platform's
 * Cache-Control: private, max-age=45 response directive).
 *
 * The cache is process-local and intentionally not shared across instances.
 * Stale-on-error: if the platform call fails, the last cached value (if any)
 * is returned rather than failing the page load. Falls through to free/none
 * if there is no cached value.
 */

import type { EntitlementResolver } from "./resolver";
import type { Subscription } from "./types";
import type { ArdaClaim } from "./types";
import type { WorkspaceQuota } from "./quota";
import { FREE_CAPABILITY_LIMITS, FREE_QUOTA_POOLS } from "./quota";
import { fetchPlatformEntitlement } from "./platform-client";

const TTL_MS = 45_000;

const FREE_FALLBACK_QUOTA: WorkspaceQuota = {
  capabilities: FREE_CAPABILITY_LIMITS,
  bundled: false,
  pools: FREE_QUOTA_POOLS,
};

interface CacheEntry {
  subscription: Subscription;
  quota: WorkspaceQuota;
  expiresAt: number;
}

export class PlatformEntitlementResolver implements EntitlementResolver {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly baseUrl: string,
    private readonly authToken: string,
  ) {}

  async resolve(claim: ArdaClaim | null, workspaceId?: string): Promise<Subscription> {
    return (await this._fetch(workspaceId)).subscription;
  }

  async resolveQuota(workspaceId?: string): Promise<WorkspaceQuota> {
    return (await this._fetch(workspaceId)).quota;
  }

  invalidateCache(workspaceId: string): void {
    this.cache.delete(workspaceId);
  }

  private async _fetch(workspaceId?: string): Promise<{ subscription: Subscription; quota: WorkspaceQuota }> {
    const wsId = workspaceId ?? "";
    if (!wsId) {
      return { subscription: { tier: null, status: null, bundled: false }, quota: FREE_FALLBACK_QUOTA };
    }

    const now = Date.now();
    const cached = this.cache.get(wsId);
    if (cached && cached.expiresAt > now) {
      return { subscription: cached.subscription, quota: cached.quota };
    }

    try {
      const result = await fetchPlatformEntitlement(wsId, this.baseUrl, this.authToken);
      this.cache.set(wsId, { ...result, expiresAt: now + TTL_MS });
      return result;
    } catch (err) {
      console.error(`[PlatformEntitlementResolver] fetch failed for ws=${wsId}:`, err);
      if (cached) return { subscription: cached.subscription, quota: cached.quota };
      return { subscription: { tier: null, status: null, bundled: false }, quota: FREE_FALLBACK_QUOTA };
    }
  }
}
