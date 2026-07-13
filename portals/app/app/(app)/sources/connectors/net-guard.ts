/**
 * Outbound target guard for source connectors.
 *
 * A connector dials a user-supplied host, which is an SSRF surface: a
 * workspace admin could otherwise point a "data source" at arda's own
 * database, Redis, or other tailnet-internal services. This guard rejects
 * the obvious internal targets by name/prefix. It is a v1 defense-in-depth
 * layer, NOT a complete SSRF answer - the real boundary is an infra-level
 * egress policy for the app container (tracked in biz-435).
 *
 * Set CONNECTOR_NET_GUARD=off ONLY for local development against a local
 * test database; never in a deployed stack.
 */

const BLOCKED_EXACT = new Set(["localhost", "0.0.0.0", "::1", "host.docker.internal"]);
const BLOCKED_SUFFIXES = ["-db", "-redis"]; // compose service names (arda-db, arda-beta-redis, ...)

export function assertConnectorTarget(host: string): void {
  if (process.env.CONNECTOR_NET_GUARD === "off") return;

  const h = host.trim().toLowerCase();
  const blocked =
    !h ||
    BLOCKED_EXACT.has(h) ||
    h.startsWith("127.") ||
    h.startsWith("169.254.") || // link-local / cloud metadata
    h.startsWith("100.") || // tailnet CGNAT range (platform-internal services)
    BLOCKED_SUFFIXES.some((s) => h.endsWith(s)) ||
    h === dbHost();

  if (blocked) {
    const err = new Error(`connector target blocked: ${h}`);
    (err as { reason?: string }).reason = "blocked";
    throw err;
  }
}

function dbHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname.toLowerCase();
  } catch {
    return "";
  }
}
