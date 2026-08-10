import assert from "node:assert/strict";
import { test } from "node:test";
import { problem } from "./problem";

test("problem emits an RFC 9457 envelope with the stable code", async () => {
  const res = problem(403, "insufficient_scope", "This endpoint requires the 'catalog:read' scope.");
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("content-type"), "application/problem+json");
  const body = await res.json();
  assert.deepEqual(body, {
    type: "https://arda.vxture.com/problems/insufficient_scope",
    title: "Forbidden",
    status: 403,
    code: "insufficient_scope",
    detail: "This endpoint requires the 'catalog:read' scope.",
  });
});

test("problem carries extensions and extra headers", async () => {
  const res = problem(429, "rate_limited", undefined, undefined, { "retry-after": "42" });
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("retry-after"), "42");
  const body = await res.json();
  assert.equal(body.code, "rate_limited");
  assert.equal(body.title, "Too Many Requests");
  assert.equal(body.detail, undefined);
});
