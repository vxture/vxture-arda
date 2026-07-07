/**
 * HMAC-SHA256 webhook signature verification.
 * Wire format per identity-platform-rp-integration §5:
 *   x-vxture-signature: t=<ts>,v1=<hex>
 *   signed payload: "<ts>.<raw_body_bytes>"
 *
 * Rejects if:
 *   - signature header is missing or malformed
 *   - timestamp is older than TOLERANCE_SEC (replay protection)
 *   - HMAC does not match
 */

const TOLERANCE_SEC = 300; // 5 min replay window

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export async function verifyWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  secret: string,
): Promise<VerifyResult> {
  if (!signatureHeader) return { ok: false, reason: "missing signature header" };

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=") as [string, string]),
  );
  const ts = parts["t"];
  const v1 = parts["v1"];
  if (!ts || !v1) return { ok: false, reason: "malformed signature header" };

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

  // signed payload = "<ts>.<raw_body>"
  const prefix = enc.encode(`${ts}.`);
  const signed = new Uint8Array(prefix.length + rawBody.length);
  signed.set(prefix, 0);
  signed.set(rawBody, prefix.length);

  const mac = await crypto.subtle.sign("HMAC", key, signed);
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected !== v1) return { ok: false, reason: "signature mismatch" };
  return { ok: true };
}
