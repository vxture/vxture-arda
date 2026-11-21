import { strict as assert } from "node:assert";
import { test } from "node:test";
import { acknowledgeProvisioning } from "./ack";
test("ACK failure is retryable with the same delivery; malformed success is rejected", async () => {
  const bodies: string[] = [];
  let unavailable = true;
  const deps = { state: async () => ({ status: "provisioned", wipedAt: null, lastSeq: 3 }),
    report: async (_ws: string, body: string) => {
      bodies.push(body);
      return unavailable ? new Response(null, { status: 503 }) : Response.json({
        workspace_id: "w1", product: "arda", acked_at: "2026-11-21T12:00:00Z", replayed: true });
    } };
  await assert.rejects(acknowledgeProvisioning("w1", 3, "d1", deps), /ack_503/);
  unavailable = false;
  await acknowledgeProvisioning("w1", 3, "d1", deps);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(JSON.parse(bodies[1]).delivery_id, "d1");
  await assert.rejects(acknowledgeProvisioning("w1", 3, "d1", { ...deps,
    report: async () => Response.json({ workspace_id: "other" }) }), /ack_invalid/);
});
test("stopped, missing and superseded workspaces never report ready", async () => {
  const states = [null, { status: "deprovisioned", wipedAt: null, lastSeq: 3 },
    { status: "provisioned", wipedAt: new Date(), lastSeq: 3 },
    { status: "provisioned", wipedAt: null, lastSeq: 4 }];
  for (const current of states) {
    await acknowledgeProvisioning("w1", 3, "d1", { state: async () => current,
      report: async () => { throw new Error("must not report"); } });
  }
});
