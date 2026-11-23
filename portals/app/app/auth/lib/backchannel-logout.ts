import type { JWTPayload } from "jose";

const EVENT = "http://schemas.openid.net/event/backchannel-logout";

/** Only call after signature, issuer, audience and expiry verification. */
export function logoutSid(claims: JWTPayload): string {
  const events = claims.events;
  if (claims.nonce !== undefined || !events || typeof events !== "object" || Array.isArray(events)) {
    throw new Error("invalid logout events");
  }
  const event = (events as Record<string, unknown>)[EVENT];
  if (!event || typeof event !== "object" || Array.isArray(event)
    || typeof claims.sid !== "string" || !claims.sid.trim()
    || typeof claims.jti !== "string" || !claims.jti.trim()
    || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp)
    || claims.exp! <= claims.iat!) throw new Error("invalid logout claims");
  return claims.sid;
}

/** A valid delivery succeeds only after deletion; a failed deletion may retry. */
export async function receiveBackchannelLogout(request: Request, deps: {
  verify(token: string): Promise<JWTPayload>;
  destroy(sid: string): Promise<unknown>;
}): Promise<Response> {
  const headers = { "Cache-Control": "no-store" };
  const form = await request.formData().catch(() => null);
  const token = form?.get("logout_token");
  if (typeof token !== "string" || !token) return new Response("missing logout_token", { status: 400, headers });
  let sid: string;
  try { sid = logoutSid(await deps.verify(token)); }
  catch { return new Response("invalid logout_token", { status: 400, headers }); }
  try { await deps.destroy(sid); }
  catch { return new Response("logout unavailable", { status: 503, headers }); }
  return new Response(null, { status: 200, headers });
}
