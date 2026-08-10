import assert from "node:assert/strict";
import { test } from "node:test";
import type { NextRequest } from "next/server";
import {
  isUniqueViolation,
  readIdempotencyKey,
  runIdempotentCreate,
  storedIdempotencyKey,
} from "./idempotency";

function reqWithHeader(value?: string): NextRequest {
  const headers = new Headers();
  if (value !== undefined) headers.set("idempotency-key", value);
  return { headers } as unknown as NextRequest;
}

test("readIdempotencyKey: absent header is fine, garbage is invalid", () => {
  assert.deepEqual(readIdempotencyKey(reqWithHeader()), { key: null });
  assert.deepEqual(readIdempotencyKey(reqWithHeader("retry-42_a.b")), { key: "retry-42_a.b" });
  assert.deepEqual(readIdempotencyKey(reqWithHeader("")), { invalid: true });
  assert.deepEqual(readIdempotencyKey(reqWithHeader("has space")), { invalid: true });
  assert.deepEqual(readIdempotencyKey(reqWithHeader("x".repeat(181))), { invalid: true });
});

test("storedIdempotencyKey namespaces per workspace", () => {
  assert.equal(storedIdempotencyKey("ws1", "k"), "api:ws1:k");
  assert.notEqual(storedIdempotencyKey("ws1", "k"), storedIdempotencyKey("ws2", "k"));
});

test("isUniqueViolation matches P2002 on the named constraint only", () => {
  assert.equal(isUniqueViolation({ code: "P2002", meta: { target: ["idempotencyKey"] } }, "idempotencyKey"), true);
  assert.equal(isUniqueViolation({ code: "P2002", meta: { target: "AuditLog_idempotencyKey_key" } }, "idempotencyKey"), true);
  assert.equal(isUniqueViolation({ code: "P2002", meta: { target: ["workspaceId", "code"] } }, "idempotencyKey"), false);
  assert.equal(isUniqueViolation({ code: "P2025" }, "idempotencyKey"), false);
  assert.equal(isUniqueViolation(new Error("boom"), "idempotencyKey"), false);
});

test("runIdempotentCreate without a key just creates", async () => {
  const outcome = await runIdempotentCreate(
    { storedKey: null, action: "x" },
    async () => "made",
    async () => null,
  );
  assert.deepEqual(outcome, { kind: "created", value: "made" });
});

test("runIdempotentCreate rethrows non-idempotency unique violations", async () => {
  await assert.rejects(
    runIdempotentCreate(
      { storedKey: "api:ws:k", action: "x" },
      async () => {
        throw { code: "P2002", meta: { target: ["workspaceId", "code"] } };
      },
      async () => null,
    ),
  );
});
