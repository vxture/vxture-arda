import { strict as assert } from "node:assert";
import { test } from "node:test";
import { canUseFeature, CAPABILITY_MATRIX, FUTURE_FEATURE_KEYS } from "./capability";
import { mapToWorkspaceQuota } from "./quota";

test("individual tiers can publish services without unlocking collaboration or future features", () => {
  for (const tier of ["free", "starter", "pro"] as const) {
    const sub = { tier, status: "active" as const, bundled: false };
    assert.equal(canUseFeature(sub, "arda.services.publish_api"), true);
    assert.equal(canUseFeature(sub, "arda.governance.policies"), true);
    assert.equal(canUseFeature(sub, "arda.services.cross_workspace_share"), false);
    for (const feature of FUTURE_FEATURE_KEYS) assert.equal(canUseFeature(sub, feature), false);
  }
  assert.equal(canUseFeature({ tier: null, status: null, bundled: true }, "arda.services.publish_api"), false);
  assert.ok(CAPABILITY_MATRIX.business.includes("arda.services.cross_workspace_share"));
});

test("eligible pools include purchased capacity after a zero bundled pool", () => {
  const quota_pools = [
    { metric: "service.api.call", limit: 0, remaining: 0, priority: 0 },
    { metric: "service.api.call", limit: 2_000_000, remaining: 1_999_999, priority: 1 },
    { metric: "ai.credit", limit: 200, remaining: 180, priority: 0 },
    { metric: "ai.credit", limit: 1_500, remaining: 1_500, priority: 1 },
    { metric: "storage.bytes", limit: 100, remaining: -5, priority: 0 },
  ];
  for (const pools of [quota_pools, [...quota_pools].reverse()]) {
    const result = mapToWorkspaceQuota({ quota_pools: pools });
    assert.equal(result.pools.apiCall?.limit, 2_000_000);
    assert.equal(result.pools.apiCall?.remaining, 1_999_999);
    assert.equal(result.pools.aiCredit?.limit, 1_700);
    assert.equal(result.pools.aiCredit?.remaining, 1_680);
    assert.equal(result.pools.storageBytes?.remaining, -5);
    assert.equal(result.pools.qualityCheckRun, null);
  }
});

test("canonical seats and pinned legacy member limits both preserve team capacity", () => {
  assert.equal(mapToWorkspaceQuota({ limits: { "seat.max": 5 } }).limits.memberMax, 5);
  assert.equal(mapToWorkspaceQuota({ limits: { "member.max": 8 } }).limits.memberMax, 8);
  assert.equal(mapToWorkspaceQuota({ limits: { "seat.max": 5, "member.max": 1 } }).limits.memberMax, 5);
  assert.equal(mapToWorkspaceQuota({ limits: { "seat.max": 0 } }).limits.memberMax, 0);
  assert.equal(mapToWorkspaceQuota({ limits: { "seat.max": -1 } }).limits.memberMax, null);
  assert.equal(mapToWorkspaceQuota({ capabilities: { "member.max": 8 } }).limits.memberMax, 8);
});
