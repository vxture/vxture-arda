import { test } from "node:test";
import assert from "node:assert/strict";
import { logoutSid, receiveBackchannelLogout } from "./backchannel-logout";

const event = "http://schemas.openid.net/event/backchannel-logout";
const valid = () => ({ sid: "central-customer-session", jti: "delivery-id", iat: 100, exp: 220,
  events: { [event]: {} } });
const request = (body = "logout_token=signed-delivery") => new Request("https://arda.ruyin.work/auth/backchannel-logout", {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
});

test("verified logout rejects malformed events, identities and lifetime before any deletion", async () => {
  assert.equal(logoutSid(valid()), "central-customer-session");
  for (const patch of [{ nonce: "forbidden" }, { events: [] }, { events: null },
    { events: { [event]: [] } }, { events: { [event]: null } }, { events: {} },
    { sid: " " }, { jti: " " }, { jti: undefined }, { iat: 1.5 },
    { exp: undefined }, { exp: 100 }, { exp: 90 }]) {
    let deleted = false;
    const response = await receiveBackchannelLogout(request(), {
      async verify() { return { ...valid(), ...patch }; },
      async destroy() { deleted = true; },
    });
    assert.equal(response.status, 400);
    assert.equal(deleted, false);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("signature failure and absent or malformed form never revoke sessions", async () => {
  let verified = 0;
  let destroyed = 0;
  const deps = { async verify() { verified++; throw new Error("private verification detail"); },
    async destroy() { destroyed++; } };
  const response = await receiveBackchannelLogout(request(), deps);
  assert.equal(response.status, 400);
  assert.equal(await response.text(), "invalid logout_token");
  for (const req of [request(""), new Request("https://arda.ruyin.work/auth/backchannel-logout", {
    method: "POST", body: "not-a-form",
  })]) assert.equal((await receiveBackchannelLogout(req, deps)).status, 400);
  assert.equal(verified, 1);
  assert.equal(destroyed, 0);
});

test("store outage returns503 and same signed delivery retries until idempotent completion", async () => {
  let fail = true;
  const sessions = new Set(["rp-one", "rp-two"]);
  const deps = {
    async verify(token: string) { assert.equal(token, "signed-delivery"); return valid(); },
    async destroy(sid: string) {
      assert.equal(sid, "central-customer-session");
      if (fail) throw new Error("private Redis detail");
      sessions.clear();
    },
  };
  const failed = await receiveBackchannelLogout(request(), deps);
  assert.equal(failed.status, 503);
  assert.equal(await failed.text(), "logout unavailable");
  assert.equal(sessions.size, 2);
  fail = false;
  for (let i = 0; i < 2; i++) {
    const response = await receiveBackchannelLogout(request(), deps);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(sessions.size, 0);
});
