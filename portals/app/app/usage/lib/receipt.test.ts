import { strict as assert } from "node:assert";
import { test } from "node:test";
import { consumeReceipt } from "./receipt";

test("a gated HTTP 200 report is acknowledged; a reserve rejection is never acknowledged", async () => {
  assert.deepEqual(await consumeReceipt(Response.json({ consumed: 2, remaining_total: 0, gated: true, event_id: "evt1" })), { gated: true, eventId: "evt1" });
  await assert.rejects(consumeReceipt(Response.json({ consumed: 0, gated: true }, { status: 409 })), /http_409/);
  await assert.rejects(consumeReceipt(Response.json({ error: "unavailable" }, { status: 503 })), /http_503/);
});

test("malformed success receipts leave the durable report unacknowledged", async () => {
  for (const body of [{}, { consumed: -1, remaining_total: 0 }, { consumed: 1, remaining_total: 0, gated: "yes" }]) {
    await assert.rejects(consumeReceipt(Response.json(body)), /invalid_receipt/);
  }
});
