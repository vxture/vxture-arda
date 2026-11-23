import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizedRoster } from "./roster";
import type { platformRequest } from "./client";
const context = { orgId: "o1", workspaceId: "w1", subject: "reader", subjectToken: "server-only" };
const member = (n: number) => ({ subject: `usr_00000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
  display_name: null, eligible: true });
const page = (items = [member(1)], extra = {}) => ({ org_id: "o1", workspace_id: "w1", product: "arda",
  authorization_mode: "assigned_seats", version: "a".repeat(32), items, nextCursor: null, ...extra });
const request = (values: (object | number)[]) => {
  const paths: string[] = [];
  const read: typeof platformRequest = async (path, scope) => {
    paths.push(path); assert.deepEqual(scope, context);
    const value = values.shift(); assert.notEqual(value, undefined, "unexpected authority call");
    return typeof value === "number" ? new Response(null, { status: value }) : Response.json(value);
  };
  return { read, paths };
};
test("reads all pages with ticket context and a consistent version", async () => {
  const source = request([page([member(1)], { nextCursor: "cursor1" }), page([member(2)])]);
  const result = await authorizedRoster(context, source.read);
  assert.deepEqual(result.items, [member(1), member(2)]);
  assert.equal(source.paths[1], "/platform/product-roster?limit=200&cursor=cursor1");
});
test("revocation replaces the next snapshot; no historical local role restores a removed member", async () => {
  const source = request([page(), page([]), 403]);
  assert.equal((await authorizedRoster(context, source.read)).items.length, 1);
  assert.deepEqual((await authorizedRoster(context, source.read)).items, []);
  await assert.rejects(authorizedRoster(context, source.read), /roster_403/);
});
test("409 restarts once and never returns a partial snapshot", async () => {
  const source = request([page([member(1)], { nextCursor: "cursor1" }), 409, page([member(2)])]);
  assert.deepEqual((await authorizedRoster(context, source.read)).items, [member(2)]);
  await assert.rejects(authorizedRoster(context, request([409, 409]).read), /roster_changed/);
});
test("invalid scope, denied eligibility, missing names and cursor loops fail closed", async () => {
  for (const extra of [{ product: "other" }, { org_id: "other" }, { workspace_id: "other" },
    { authorization_mode: "open" }, { version: "" }, { nextCursor: undefined },
    { items: [{ ...member(1), eligible: false }] }, { items: [{ subject: member(1).subject, eligible: true }] }]) {
    await assert.rejects(authorizedRoster(context, request([page([member(1)], extra)]).read));
  }
  await assert.rejects(authorizedRoster(context, request([page([member(1)], { nextCursor: "same" }),
    page([member(2)], { nextCursor: "same" })]).read), /roster_cursor_loop/);
  await assert.rejects(authorizedRoster(context, request([page([member(1)], { nextCursor: "c" }), page()]).read), /roster_invalid_member/);
  await assert.rejects(authorizedRoster(context, request([503]).read), /roster_503/);
});
test("version disagreement restarts and never combines old and new pages", async () => {
  const source = request([page([member(1)], { nextCursor: "c" }), page([member(2)], { version: "b".repeat(32) }), page([])]);
  assert.deepEqual((await authorizedRoster(context, source.read)).items, []);
});
