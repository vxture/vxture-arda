import Redis from "ioredis";

/**
 * Per-key fixed-window rate limit for /api/v1, backed by the stack's Redis
 * (arda-redis; sessions live there too, key family `apirl:*`).
 *
 * The limiter is overload PROTECTION, not authorization - authorization is the
 * key/scope/entitlement chain in auth.ts. It therefore fails OPEN: when
 * REDIS_URL is unset or Redis is unreachable the request proceeds (logged),
 * instead of turning a cache outage into a full API outage.
 */

export const WINDOW_MS = 60_000;
const DEFAULT_LIMIT_PER_MINUTE = 120;
// Window keys outlive the window slightly so a clock-edge INCR never resurrects
// an expired counter mid-decision.
const KEY_TTL_MS = WINDOW_MS + 5_000;

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets (ceil; >= 1). */
  retryAfterSeconds: number;
}

export function limitPerMinute(): number {
  const n = Number(process.env.API_RATE_LIMIT_PER_MINUTE);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT_PER_MINUTE;
  return Math.floor(n);
}

/** Pure decision from a window counter value (testable without Redis). */
export function decide(count: number, limit: number, nowMs: number): RateLimitDecision {
  const windowEnd = (Math.floor(nowMs / WINDOW_MS) + 1) * WINDOW_MS;
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - nowMs) / 1000)),
  };
}

let client: Redis | null = null;

function redis(): Redis | null {
  const url = (process.env.REDIS_URL || "").trim();
  if (!url) return null;
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
  }
  return client;
}

export async function checkRateLimit(apiKeyId: string): Promise<RateLimitDecision> {
  const limit = limitPerMinute();
  const now = Date.now();
  const r = redis();
  if (!r) return decide(1, limit, now);

  const window = Math.floor(now / WINDOW_MS);
  const key = `apirl:${apiKeyId}:${window}`;
  try {
    const count = await r.incr(key);
    if (count === 1) await r.pexpire(key, KEY_TTL_MS);
    return decide(count, limit, now);
  } catch (err) {
    console.error("[api/rate-limit] redis unavailable, failing open:", err);
    return decide(1, limit, now);
  }
}
