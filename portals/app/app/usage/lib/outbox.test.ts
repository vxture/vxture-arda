import { test } from "node:test";
import assert from "node:assert/strict";
import { flushBatch, type UsageRow, type UsageUpdate } from "./outbox";

const row: UsageRow = { id: "u1", workspaceId: "w1", product: "arda", metric: "service.api.call",
  amount: 1, idempotencyKey: "stable-key", flushAttempts: 0 };

test("409, invalid receipt and network errors retain usage; retry uses the same identity", async () => {
  const updates: UsageUpdate[] = [];
  let attempt = 0;
  const deps = {
    report: async (input: UsageRow) => {
      assert.equal(input.idempotencyKey, "stable-key");
      attempt++;
      if (attempt === 1) return new Response(null, { status: 409 });
      if (attempt === 2) return Response.json({});
      if (attempt === 3) throw new Error("network");
      return Response.json({ consumed: 1, remaining_total: 9 });
    },
    save: async (_id: string, update: UsageUpdate) => { updates.push(update); },
    invalidate: () => { assert.fail("not gated"); },
  };
  for (let i = 0; i < 3; i++) assert.equal((await flushBatch([row], deps)).failed, 1);
  assert.ok(updates.every(update => update.flushed === undefined));
  assert.equal((await flushBatch([row], deps)).succeeded, 1);
  assert.equal(updates[3].flushed, true);
});

test("gated 200 acknowledges actual usage; persistence failure remains retryable", async () => {
  const invalidated: string[] = [];
  const deps = {
    report: async () => Response.json({ consumed: 1, remaining_total: -1, gated: true }),
    save: async (_id: string, update: UsageUpdate) => { assert.equal(update.flushed, true); },
    invalidate: (workspaceId: string) => { invalidated.push(workspaceId); },
  };
  assert.equal((await flushBatch([row], deps)).gated, 1);
  assert.deepEqual(invalidated, ["w1"]);
  await assert.rejects(flushBatch([row], { ...deps, save: async () => { throw new Error("db unavailable"); } }), /db unavailable/);
  assert.equal(invalidated.length, 1);
});
