/**
 * S2S egress guard (arda-plat-220 §4 / B1).
 *
 * arda's C2/C3 calls carry a shared S2S secret (x-vxture-internal-auth). Those
 * calls MUST stay on the internal network (tailnet, WireGuard-encrypted) and
 * NEVER traverse the public internet in cleartext. This guard refuses to send
 * over plaintext http to a host that is not demonstrably internal, so a
 * misconfigured PLATFORM_API_URL (e.g. the public http://accounts.vxture.com)
 * fails fast INSTEAD of leaking the secret to a public endpoint.
 *
 * Allowed:
 *   - any https:// target (encrypted in transit)
 *   - http:// to localhost / loopback
 *   - http:// to a private/tailnet address: 100.64.0.0/10 (Tailscale CGNAT),
 *     10/8, 172.16/12, 192.168/16, or a *.ts.net / *.tailnet MagicDNS name
 * Refused:
 *   - http:// to any public host (would leak the S2S secret in cleartext)
 */

/** True when `host` is a loopback / private / tailnet address or name. */
function isInternalHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (h.endsWith(".ts.net") || h.endsWith(".tailnet") || h.endsWith(".internal")) return true;
  // Tailscale CGNAT 100.64.0.0/10 = 100.64.0.0 .. 100.127.255.255
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 100 && b >= 64 && b <= 127) return true; // tailnet
    if (a === 10) return true; // 10/8
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 127) return true; // loopback
  }
  return false;
}

/**
 * Throws if `rawUrl` would send an S2S credential over cleartext http to a
 * public host. Call this before any C2/C3 fetch that sets x-vxture-internal-auth.
 */
export function assertInternalTarget(rawUrl: string): void {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error(`invalid platform API URL: ${rawUrl}`);
  }
  if (u.protocol === "https:") return; // encrypted in transit
  if (u.protocol !== "http:") throw new Error(`unsupported scheme for platform API: ${u.protocol}`);
  if (!isInternalHost(u.hostname)) {
    throw new Error(
      `refusing to send the S2S credential over cleartext http to public host ` +
        `'${u.hostname}'. PLATFORM_API_URL must be an internal (tailnet) address ` +
        `or use https (arda-plat-220 §4 / B1).`,
    );
  }
}
