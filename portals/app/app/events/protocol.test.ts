import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAccessEvent } from "./protocol";

test("browser invalidations have a bounded non-authoritative vocabulary", () => {
  assert.deepEqual(parseAccessEvent('{"type":"revoked"}'), { type: "revoked" });
  const message = { type: "ready", revision: "0", context: "a".repeat(64) };
  assert.deepEqual(parseAccessEvent(JSON.stringify(message)), message);
  for (const bad of [null, {}, { ...message, type: "grant" }, { ...message, context: "workspace-secret" }, { ...message, revision: "NaN" }]) {
    assert.throws(() => parseAccessEvent(JSON.stringify(bad)));
  }
  assert.throws(() => parseAccessEvent("x".repeat(2049)));
});
