import { strict as assert } from "node:assert";
import { test } from "node:test";
import { accessState, sessionScope } from "./state";
import { isWorkspaceAdmin } from "../../entitlement/roles";
import { productSubscriptionUrl } from "../../entitlement/deeplink";
import type { SessionUser } from "../api";
import type { Subscription } from "../../entitlement/types";

const user: SessionUser = { sub: "u1", displayName: "User", username: "user", avatarUrl: "", email: "", emailVerified: false, phone: "", phoneVerified: false, accountStatus: "active", orgId: "o1", orgType: "team", orgName: "Org", workspaceId: "w1", workspaceName: "Workspace", roles: ["workspace:member"], userType: "user", ardaClaim: null };
const sub: Subscription = { tier: "pro", status: "active", bundled: false, productAssigned: true };

test("platform-admitted new members have baseline use without governance role assignment", () => {
  assert.equal(accessState(sub, user), "connected");
  assert.equal(accessState(sub, { ...user, roles: [] }), "connected");
  assert.equal(isWorkspaceAdmin([]), false);
  assert.equal(accessState(sub, { ...user, roles: ["org:member", "other:owner"] }), "connected");
  assert.equal(isWorkspaceAdmin(["org:member", "other:owner"]), false);
});

test("platform assignment denial overrides workspace owner role without becoming a role or billing prompt", () => {
  assert.equal(accessState({ ...sub, productAssigned: undefined }, user), "access-unavailable");
  assert.equal(accessState({ ...sub, productAssigned: false }, { ...user, roles: ["workspace:owner"] }), "access-unavailable");
});

test("unknown context and operational suspension never become a purchase prompt", () => {
  assert.equal(accessState(sub, { ...user, workspaceId: "" }), "access-unavailable");
  assert.equal(accessState({ ...sub, status: "suspended", tier: null }, user), "access-unavailable");
  assert.equal(accessState({ ...sub, status: null, tier: null }, user), "subscription");
  assert.equal(accessState({ ...sub, status: "expired", tier: null }, user), "expired");
  assert.equal(accessState({ ...sub, status: null }, user), "connected");
});

test("recovery scope changes invalidate old work, role ordering does not", () => {
  const key = sessionScope(user);
  for (const change of [{ sub: "u2" }, { orgId: "o2" }, { workspaceId: "w2" }, { roles: ["workspace:owner"] }, { accountStatus: "disabled" }]) assert.notEqual(sessionScope({ ...user, ...change }), key);
  assert.equal(sessionScope({ ...user, roles: ["org:owner", "workspace:member"] }), sessionScope({ ...user, roles: ["workspace:member", "org:owner"] }));
});

test("commercial entry uses public product pricing without order intent", () => {
  assert.equal(productSubscriptionUrl(), "https://vxture.com/zh-CN/pricing?product=arda");
  assert.equal(productSubscriptionUrl("en-US"), "https://vxture.com/en-US/pricing?product=arda");
  assert.equal(productSubscriptionUrl("https://untrusted.test"), productSubscriptionUrl());
});
