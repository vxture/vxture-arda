import { test } from "node:test";
import assert from "node:assert/strict";
import type { OidcConfig } from "./config";
import { checkCentralSession } from "./central-session";

const cfg = { clientId: "arda", clientSecret: "test-only",
  endpoints: { token: "http://100.64.0.1:8081/oidc/token" } } as OidcConfig;

test("central status uses confidential internal transport and preserves the server deadline", async () => {
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(url, "http://100.64.0.1:8081/oidc/session/status");
    assert.deepEqual(JSON.parse(String(options?.body)), { sid: "sid_1", active: true });
    assert.match(new Headers(options?.headers).get("Authorization")!, /^Basic /);
    assert.equal(options?.redirect, "error");
    return Response.json({ valid: true, next_check_at: 1500 });
  };
  assert.deepEqual(await checkCentralSession(cfg, "sid_1", fetcher, 1000), { valid: true, next_check_at: 1500 });
});

test("only explicit successful false means logout; transport, credentials and malformed results stay unavailable", async () => {
  assert.deepEqual(await checkCentralSession(cfg, "sid_1", async () => Response.json({ valid: false })), { valid: false });
  for (const response of [Response.json({ valid: false }, { status: 503 }),
    Response.json({ valid: false }, { status: 401 }), Response.json({ valid: "false" }),
    Response.json({ valid: true, next_check_at: 999 }), Response.json({ valid: true })]) {
    await assert.rejects(checkCentralSession(cfg, "sid_1", async () => response, 1000));
  }
  await assert.rejects(checkCentralSession(cfg, "sid_1", async () => { throw new Error("network"); }));
});
