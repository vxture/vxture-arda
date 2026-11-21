import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PlatformEntitlementResolver } from "./platform-resolver";

test("explicit entry recheck bypasses TTL and propagates failure instead of cached access", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ workspace_id: "w1", product: "arda", status: "active", tier: "pro", bundled: false }); };
  try {
    const resolver = new PlatformEntitlementResolver("http://127.0.0.1", "test-only");
    assert.equal((await resolver.resolve(null, "w1")).status, "active");
    await resolver.resolve(null, "w1");
    assert.equal(calls, 1);
    await resolver.resolveFresh(null, "w1");
    assert.equal(calls, 2);
    globalThis.fetch = async () => { throw new Error("network unavailable"); };
    await assert.rejects(resolver.resolveFresh(null, "w1"), /network unavailable/);
    await assert.rejects(resolver.resolveFresh(null, ""), /workspace required/);
  } finally { globalThis.fetch = previous; }
});
