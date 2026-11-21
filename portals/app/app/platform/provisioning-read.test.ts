import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ProvisioningReadClient, validateProvisioningReadClaims } from "./provisioning-read";
import type { OidcConfig } from "../auth/lib/config";
const claims = { aud: "vxture", act: { sub: "arda" }, scope: "provisioning:read",
  mode: "service", iat: 1000, exp: 1300 };
test("read tickets reject workspace, user, delegated and write authority", () => {
  validateProvisioningReadClaims(claims, 1100);
  for (const change of [{ aud: "atlas" }, { act: { sub: "karda" } }, { act: { sub: "arda", extra: true } },
    { sub: "u1" }, { workspace_id: "w1" }, { org_id: "o1" }, { tenant_id: "o1" },
    { delegated: false }, { mode: "obo" }, { scope: "tool:vxture" }, { iat: 1000.5 },
    { exp: 1301 }, { exp: 1100 }]) {
    assert.throws(() => validateProvisioningReadClaims({ ...claims, ...change }, 1100));
  }
});
test("read exchange uses Basic without workspace context; unauthorized page refreshes once", async () => {
  let exchanges = 0, reads = 0;
  const now = Math.floor(Date.now() / 1000);
  const cfg = { clientId: "arda", clientSecret: "test-secret",
    endpoints: { token: "http://127.0.0.1/oidc/token" } } as OidcConfig;
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(init?.redirect, "error");
    if (String(url).includes("oidc/token")) {
      exchanges++;
      const form = new URLSearchParams(String(init?.body));
      assert.equal(form.get("scope"), "provisioning:read");
      assert.equal(form.has("workspace_id"), false);
      assert.equal(form.has("org_id"), false);
      assert.equal(form.has("subject_token"), false);
      assert.match(new Headers(init?.headers).get("Authorization")!, /^Basic /);
      return Response.json({ token_type: "Bearer", access_token: `token-${exchanges}` });
    }
    reads++;
    if (reads === 1) return new Response(null, { status: 401 });
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer token-2");
    return Response.json({ items: [], nextCursor: null });
  };
  const client = new ProvisioningReadClient(cfg, "http://127.0.0.1", fetcher,
    async () => ({ ...claims, iat: now, exp: now + 300 }));
  assert.deepEqual(await client.page(), { items: [], nextCursor: null });
  await client.page();
  assert.equal(exchanges, 2);
});
