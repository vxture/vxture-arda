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

test("canonical seats and pinned legacy member limits both preserve team capacity", () => {
  assert.equal(mapToWorkspaceQuota({ limits: { "seat.max": 5 } }).limits.memberMax, 5);
  assert.equal(mapToWorkspaceQuota({ limits: { "member.max": 8 } }).limits.memberMax, 8);
  assert.equal(mapToWorkspaceQuota({ limits: { "seat.max": 5, "member.max": 1 } }).limits.memberMax, 5);
  assert.equal(mapToWorkspaceQuota({ limits: { "seat.max": 0 } }).limits.memberMax, 0);
  assert.equal(mapToWorkspaceQuota({ limits: { "seat.max": -1 } }).limits.memberMax, null);
  assert.equal(mapToWorkspaceQuota({ capabilities: { "member.max": 8 } }).limits.memberMax, 8);
});
