import { test } from "node:test";
import assert from "node:assert/strict";
import { admitProductUser } from "./admission";
import { parseEntitlementEnvelope } from "../entitlement/platform-client";

const context = { orgId: "o1", workspaceId: "w1", subject: "usr_1", subjectToken: "server-token" };

test("assignment denial stops admission before any business/entitlement read", async () => {
  assert.equal(await admitProductUser(context, { assigned: async () => false,
    entitlement: async () => { assert.fail("must not read"); } }), false);
});

test("business admission requires effective tier and propagates unavailable decisions", async () => {
  const result = parseEntitlementEnvelope({ workspace_id: "w1", product: "arda", status: "active", tier: null, bundled: true });
  const deps = { assigned: async () => true, entitlement: async (workspaceId: string) => {
    assert.equal(workspaceId, context.workspaceId);
    return result;
  } };
  assert.equal(await admitProductUser(context, deps), false);
  assert.equal(await admitProductUser(context, { ...deps, entitlement: async () => ({ ...result,
    subscription: { ...result.subscription, tier: "pro", status: null } }) }), true);
  await assert.rejects(admitProductUser(context, { ...deps,
    assigned: async () => { throw new Error("platform unavailable"); } }), /platform unavailable/);
});


test("a formerly admitted member is denied on the next request after platform revocation", async () => {
  let assigned = true;
  const subscription = parseEntitlementEnvelope({ workspace_id: "w1", product: "arda", status: "active", tier: "pro", bundled: false });
  const deps = { assigned: async () => assigned, entitlement: async () => subscription };
  assert.equal(await admitProductUser(context, deps), true);
  assigned = false;
  assert.equal(await admitProductUser(context, deps), false);
});
