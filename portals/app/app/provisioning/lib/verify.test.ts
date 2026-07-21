/**
 * Unit tests for webhook signature verification, focused on the app-side dual
 * secret rotation slot (rectification D3 / 080-rp SS4).
 *
 * Zero-dependency node:test suite - run with `node --import tsx --test`.
 * Signatures are produced with the same WebCrypto HMAC-SHA256 the verifier
 * uses, so these exercise the real crypto path rather than a stub.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { verifyWebhookSignature, verifyWebhookSignatureAny } from "./verify";

const enc = new TextEncoder();

/** Build a valid `t=..,v1=..` header for a body signed with `secret`. */
async function sign(secret: string, body: string, ts?: number): Promise<string> {
  const t = ts ?? Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${body}`));
  const v1 = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${t},v1=${v1}`;
}

const BODY = JSON.stringify({ id: "evt_1", type: "tenant.provisioned", seq: 1 });
const raw = () => enc.encode(BODY);

test("accepts a payload signed with the current (first) secret", async () => {
  const header = await sign("current-secret", BODY);
  const r = await verifyWebhookSignatureAny(raw(), header, ["current-secret", "next-secret"]);
  assert.equal(r.ok, true);
});

test("accepts a payload signed with the NEXT secret during rotation (D3)", async () => {
  const header = await sign("next-secret", BODY);
  const r = await verifyWebhookSignatureAny(raw(), header, ["current-secret", "next-secret"]);
  assert.equal(r.ok, true);
});

test("rejects a payload signed with neither secret", async () => {
  const header = await sign("attacker-secret", BODY);
  const r = await verifyWebhookSignatureAny(raw(), header, ["current-secret", "next-secret"]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "signature mismatch");
});

test("single-secret slot still works (no rotation in progress)", async () => {
  const header = await sign("only-secret", BODY);
  const r = await verifyWebhookSignatureAny(raw(), header, ["only-secret"]);
  assert.equal(r.ok, true);
});

test("empty secret list is a misconfiguration, not a pass", async () => {
  const header = await sign("whatever", BODY);
  const r = await verifyWebhookSignatureAny(raw(), header, []);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no secret configured");
});

test("propagates replay rejection (timestamp out of tolerance)", async () => {
  const header = await sign("current-secret", BODY, 1000);
  const r = await verifyWebhookSignatureAny(raw(), header, ["current-secret"]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "timestamp out of tolerance");
});

test("single-secret verifyWebhookSignature is unchanged", async () => {
  const header = await sign("s", BODY);
  assert.equal((await verifyWebhookSignature(raw(), header, "s")).ok, true);
  assert.equal((await verifyWebhookSignature(raw(), header, "other")).ok, false);
});
