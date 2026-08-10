import assert from "node:assert/strict";
import { test } from "node:test";
import { LIMIT_DEFAULT, LIMIT_MAX, clampLimit, decodeCursor, encodeCursor, pageOf } from "./pagination";

test("clampLimit falls back to the default on garbage", () => {
  assert.equal(clampLimit(null), LIMIT_DEFAULT);
  assert.equal(clampLimit(""), LIMIT_DEFAULT);
  assert.equal(clampLimit("abc"), LIMIT_DEFAULT);
  assert.equal(clampLimit("-5"), LIMIT_DEFAULT);
  assert.equal(clampLimit("0"), LIMIT_DEFAULT);
});

test("clampLimit clamps to the max and floors decimals", () => {
  assert.equal(clampLimit("50"), 50);
  assert.equal(clampLimit("100000"), LIMIT_MAX);
  assert.equal(clampLimit("7.9"), 7);
});

test("cursor round-trips its row id", () => {
  const token = encodeCursor("ckxyz123");
  assert.equal(decodeCursor(token), "ckxyz123");
});

test("decodeCursor rejects malformed tokens", () => {
  assert.equal(decodeCursor("not-base64-json"), null);
  assert.equal(decodeCursor(""), null);
  assert.equal(decodeCursor(Buffer.from("{}").toString("base64url")), null);
  assert.equal(decodeCursor(Buffer.from('{"id":42}').toString("base64url")), null);
  assert.equal(decodeCursor(Buffer.from('{"id":""}').toString("base64url")), null);
});

test("pageOf returns no cursor when the page is not full", () => {
  const rows = [{ id: "a" }, { id: "b" }];
  assert.deepEqual(pageOf(rows, 5), { data: rows, nextCursor: null });
});

test("pageOf slices the sentinel row and points the cursor at the last kept row", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const page = pageOf(rows, 2);
  assert.deepEqual(
    page.data.map((r) => r.id),
    ["a", "b"],
  );
  assert.equal(page.nextCursor && decodeCursor(page.nextCursor), "b");
});
