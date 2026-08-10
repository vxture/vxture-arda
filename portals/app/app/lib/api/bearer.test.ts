import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedCallers } from "./bearer";

test("allowedCallers parses the comma list and trims", () => {
  assert.deepEqual([...allowedCallers("runos")], ["runos"]);
  assert.deepEqual([...allowedCallers(" runos , atlas ")], ["runos", "atlas"]);
});

test("allowedCallers is empty (bearer plane disabled) on blank/unset", () => {
  assert.equal(allowedCallers("").size, 0);
  assert.equal(allowedCallers(undefined).size, 0);
  assert.equal(allowedCallers(" , ,").size, 0);
});
