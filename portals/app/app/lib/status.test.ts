import { test } from "node:test";
import assert from "node:assert/strict";
import { createStatusReader, statusMode } from "./status";

test("concurrent status readers share a probe and refresh only after expiry", async () => {
  let time = 0;
  let probes = 0;
  const read = createStatusReader(async () => {
    probes++;
    return { database: true, redis: probes === 1 };
  }, 30_000, () => time);

  const first = await Promise.all([read(), read()]);
  const original = { status: "operational", updatedAt: new Date(0).toISOString() };
  assert.deepEqual(first, [original, original]);
  time = 29_999;
  assert.deepEqual(await read(), original);
  assert.equal(probes, 1);

  time = 30_000;
  assert.deepEqual(await read(), { status: "degraded", updatedAt: new Date(time).toISOString() });
  assert.equal(probes, 2);
});

test("summaries expose only status and timestamp, even if a probe fails", async () => {
  const expected = { status: "unavailable", updatedAt: new Date(0).toISOString() };
  const failed = createStatusReader(async () => ({ database: false, redis: false }), 30_000, () => 0);
  const rejected = createStatusReader(async () => { throw new Error("private detail"); }, 30_000, () => 0);
  assert.deepEqual(await failed(), expected);
  assert.deepEqual(await rejected(), expected);
});

test("status mode defaults to public and accepts off/authed", () => {
  assert.equal(statusMode({}), "public");
  assert.equal(statusMode({ STATUS_PAGE: "off" }), "off");
  assert.equal(statusMode({ STATUS_PAGE: "authed" }), "authed");
  assert.equal(statusMode({ STATUS_PAGE: "garbage" }), "public");
});
