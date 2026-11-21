import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PlatformEntitlementResolver } from "./platform-resolver";
import { parseEntitlementEnvelope, validateEntitlementScope } from "./platform-client";

const body = { workspace_id: "w1", product: "arda", status: "active", tier: "pro", bundled: false };
const result = () => parseEntitlementEnvelope(body);

test("fresh entry bypasses TTL; expired cache and outage never preserve access", async () => {
  let now = 0, calls = 0, failed = false;
  const resolver = new PlatformEntitlementResolver(async () => {
    calls++;
    if (failed) throw new Error("network unavailable");
    return result();
  }, () => now);
  await resolver.resolve(null, "w1");
  await resolver.resolve(null, "w1");
  assert.equal(calls, 1);
  await resolver.resolveFresh(null, "w1");
  assert.equal(calls, 2);
  failed = true;
  await assert.rejects(resolver.resolveFresh(null, "w1"), /network unavailable/);
  now = 45_001;
  await assert.rejects(resolver.resolve(null, "w1"), /network unavailable/);
  await assert.rejects(resolver.resolve(null, ""), /workspace required/);
});

test("invalidation during an in-flight C2 read cannot restore the old decision", async () => {
  let release!: (value: ReturnType<typeof result>) => void;
  const resolver = new PlatformEntitlementResolver(() => new Promise(resolve => { release = resolve; }));
  const pending = resolver.resolve(null, "w1");
  resolver.invalidateCache("w1");
  release(result());
  await assert.rejects(pending, /changed_during_read/);
});

test("C2 scope and unknown facts fail unavailable rather than suggesting a purchase", () => {
  validateEntitlementScope(body, "w1");
  validateEntitlementScope({ ...body, status: "future-status" }, "w1");
  for (const change of [{ workspace_id: "w2" }, { product: "karda" }, { status: 1 }, { tier: "future-tier" },
    { limits: { "dataset.max": "100" } }, { quota_pools: [{ metric: "ai.credit", limit: 5, remaining: "5" }] }]) {
    assert.throws(() => validateEntitlementScope({ ...body, ...change }, "w1"));
  }
  assert.throws(() => validateEntitlementScope({ workspace_id: "w1", product: "arda" }, "w1"));
});
