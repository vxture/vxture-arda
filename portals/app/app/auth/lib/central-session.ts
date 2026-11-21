import type { OidcConfig } from "./config";
import { assertInternalTarget } from "../../lib/internal-target";

export type CentralSessionStatus = { valid: false } | { valid: true; next_check_at: number };

/** Only a successful, explicit false establishes central logout. */
export async function checkCentralSession(cfg: OidcConfig, sid: string,
  fetcher: typeof fetch = fetch, now = Date.now() / 1000): Promise<CentralSessionStatus> {
  if (!sid) throw new Error("central_session_sid_required");
  const url = cfg.endpoints.token.replace(/\/token$/, "/session/status");
  assertInternalTarget(url);
  const credentials = `${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`;
  const response = await fetcher(url, {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000),
    headers: { Authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
      "Content-Type": "application/json", Accept: "application/json" },
    // Session resolution includes focus checks and token refresh, neither of
    // which establishes real user interaction. Keep this adapter read-only.
    body: JSON.stringify({ sid, active: false }),
  });
  if (response.status !== 200) throw new Error("central_session_unavailable");
  const body = await response.json() as Record<string, unknown>;
  if (body && body.valid === false) return { valid: false };
  if (!body || body.valid !== true || typeof body.next_check_at !== "number"
    || !Number.isSafeInteger(body.next_check_at) || body.next_check_at <= now) {
    throw new Error("central_session_invalid_response");
  }
  return { valid: true, next_check_at: body.next_check_at };
}
