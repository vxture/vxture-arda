import { test } from "node:test";
import assert from "node:assert/strict";
import { AccessCursor, accessSynchronizer } from "./coordinator";

test("unchanged reconnects and late events do not query authority; resets and scope changes resynchronize", () => {
  const cursor = new AccessCursor();
  const ready = { type: "ready" as const, revision: "10", context: "a".repeat(64) };
  assert.equal(cursor.accept(ready), true);
  for (let i = 0; i < 100; i++) assert.equal(cursor.accept(ready), false);
  assert.equal(cursor.accept({ ...ready, type: "changed", revision: "9" }), false);
  assert.equal(cursor.accept({ ...ready, type: "changed", revision: "11" }), true);
  assert.equal(cursor.accept({ ...ready, revision: "2" }), true, "a restored older ready snapshot requires authority");
  assert.equal(cursor.accept({ ...ready, context: "b".repeat(64) }), true);
});

test("a burst during a blocked read has one in-flight and one trailing synchronization", async () => {
  let reads = 0, concurrent = 0, maximum = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const synchronize = accessSynchronizer(async () => {
    reads++; concurrent++; maximum = Math.max(maximum, concurrent);
    await barrier; concurrent--;
  }, () => true);
  const initial = synchronize();
  const burst = Array.from({ length: 100 }, () => synchronize());
  assert.equal(reads, 1);
  release(); await Promise.all([initial, ...burst]);
  assert.equal(reads, 2); assert.equal(maximum, 1);
});

test("unmount cancels trailing synchronization and errors do not wedge the coordinator", async () => {
  let active = true, calls = 0;
  const synchronize = accessSynchronizer(async () => { calls++; active = false; }, () => active);
  await Promise.all([synchronize(), synchronize()]);
  assert.equal(calls, 1);
  let fail = true;
  const retry = accessSynchronizer(async () => { if (fail) throw new Error("unavailable"); }, () => true);
  await assert.rejects(retry(), /unavailable/);
  fail = false; await retry();
});
