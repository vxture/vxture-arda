import { strict as assert } from "node:assert";
import { test } from "node:test";
import { accessState, sessionScope } from "./state";
import { productSubscriptionUrl } from "../../entitlement/deeplink";
import type { SessionUser } from "../api";
import type { Subscription } from "../../entitlement/types";

const user: SessionUser = { sub: "u1", displayName: "User", username: "user", avatarUrl: "", email: "", emailVerified: false, phone: "", phoneVerified: false, accountStatus: "active", orgId: "o1", orgType: "team", orgName: "Org", workspaceId: "w1", workspaceName: "Workspace", roles: ["workspace:member"], userType: "user", ardaClaim: null };
const sub: Subscription = { tier: "pro", status: "active", bundled: false };

test("active subscription still requires a known usage role", () => {
  assert.equal(accessState(sub, user), "connected");
  assert.equal(accessState(sub, { ...user, roles: [] }), "unassigned");
  assert.equal(accessState(sub, { ...user, roles: ["org:member", "other:owner"] }), "unassigned");
});

test("unknown context and operational suspension never become a purchase prompt", () => {
  assert.equal(accessState(sub, { ...user, workspaceId: "" }), "access-unavailable");
  assert.equal(accessState({ ...sub, status: "suspended" }, user), "access-unavailable");
  assert.equal(accessState({ ...sub, status: null, tier: null }, user), "subscription");
  assert.equal(accessState({ ...sub, status: "expired" }, user), "expired");
});

test("recovery scope changes invalidate old work, role ordering does not", () => {
  const key = sessionScope(user);
  for (const change of [{ sub: "u2" }, { orgId: "o2" }, { workspaceId: "w2" }, { roles: ["workspace:owner"] }]) assert.notEqual(sessionScope({ ...user, ...change }), key);
  assert.equal(sessionScope({ ...user, roles: ["org:owner", "workspace:member"] }), sessionScope({ ...user, roles: ["workspace:member", "org:owner"] }));
});

test("commercial entry uses public product pricing without order intent", () => {
  assert.equal(productSubscriptionUrl(), "https://vxture.com/zh-CN/pricing?product=arda");
  assert.equal(productSubscriptionUrl("en-US"), "https://vxture.com/en-US/pricing?product=arda");
  assert.equal(productSubscriptionUrl("https://untrusted.test"), productSubscriptionUrl());
});
