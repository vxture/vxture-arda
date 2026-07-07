/**
 * HMAC-SHA256 webhook signature verification (Stripe-style, RP integration §5;
 * ruling: arda-handoff-reply-01 R1).
 *   x-vxture-signature: t=<unix_ts>,v1=<hex>[,v1=<hex> ...]
 *   signed payload:     "<ts>.<raw_request_body_bytes>"   (original bytes, no re-serialize)
 *
 * A header may carry MULTIPLE v1 values during a secret-rotation double-sign
 * window; the signature is valid if the recomputed MAC matches ANY of them.
 *
 * Rejects if:
 *   - signature header is missing or malformed (no t / no v1)
 *   - |now - t| > TOLERANCE_SEC (replay window)
 *   - the recomputed MAC matches none of the v1 candidates
 */

const TOLERANCE_SEC = 300; // 5 min replay window

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

/** Parse "t=..,v1=..,v1=.." into the timestamp and every v1 candidate. */
function parseSignatureHeader(header: string): { ts: string | null; v1s: string[] } {
  let ts: string | null = null;
  const v1s: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "t") ts = v;
    else if (k === "v1" && v) v1s.push(v);
  }
  return { ts, v1s };
}

/** Constant-time hex-string equality. Length mismatch => false (no early exit). */
function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  secret: string,
): Promise<VerifyResult> {
  if (!signatureHeader) return { ok: false, reason: "missing signature header" };

  const { ts, v1s } = parseSignatureHeader(signatureHeader);
  if (!ts || v1s.length === 0) return { ok: false, reason: "malformed signature header" };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "invalid timestamp" };
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > TOLERANCE_SEC) {
    return { ok: false, reason: "timestamp out of tolerance" };
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // signed payload = "<ts>.<raw_body>" over the ORIGINAL bytes (never re-serialize).
  const prefix = enc.encode(`${ts}.`);
  const signed = new Uint8Array(prefix.length + rawBody.length);
  signed.set(prefix, 0);
  signed.set(rawBody, prefix.length);

  const mac = await crypto.subtle.sign("HMAC", key, signed);
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare against every candidate (rotation double-sign window):
  // scan all of them (no short-circuit) and accept on any match.
  let matched = false;
  for (const v1 of v1s) {
    if (timingSafeHexEqual(expected, v1)) matched = true;
  }
  if (!matched) return { ok: false, reason: "signature mismatch" };
  return { ok: true };
}
