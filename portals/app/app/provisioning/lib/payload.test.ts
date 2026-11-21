import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseProvisioningPayload } from "./payload";
const event = { id: "d1", type: "tenant.provisioned", occurred_at: 1_795_000_000,
  seq: 1, workspace_id: "w1", tenant_id: "o1", application: "arda", plan: null, data: {} };
test("lifecycle and versionless notifications match the actual platform wire format", () => {
  assert.equal(parseProvisioningPayload(event, new Headers()).seq, 1);
  const { seq: _seq, plan: _plan, ...notification } = event;
  for (const type of ["subscription_changed", "grant.invalidated"]) {
    assert.equal(parseProvisioningPayload({ ...notification, type }, new Headers()).seq, undefined);
  }
});
test("signed identity cannot be replaced by transport headers or malformed fields", () => {
  for (const value of [null, [], { ...event, seq: undefined }, { ...event, seq: 1.1 },
    { ...event, seq: 2_147_483_648 }, { ...event, workspace_id: "" },
    { ...event, application: "karda" }, { ...event, occurred_at: "2026-11-21" },
    { ...event, type: "subscription_changed" }]) {
    assert.throws(() => parseProvisioningPayload(value, new Headers()));
  }
  for (const headers of [new Headers({ "x-vxture-delivery": "other" }), new Headers({ "x-vxture-event": "tenant.deprovisioned" })]) {
    assert.throws(() => parseProvisioningPayload(event, new Headers(headers)), /header_mismatch/);
  }
});
