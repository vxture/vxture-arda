/**
 * Unit tests for the admin-domain role gate (rectification B1+B2).
 *
 * Zero-dependency node:test suite - run with `node --import tsx --test`
 * (tsx is already a devDependency). Pins the platform contract: the access
 * token `roles` claim is a scope-prefixed array and the admin domain is
 * reachable by exactly {org:owner, workspace:owner, workspace:manager}.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { isWorkspaceAdmin } from "./roles";

test("workspace owner (scope-prefixed) is admin (B2)", () => {
  assert.equal(isWorkspaceAdmin(["workspace:owner"]), true);
});

test("workspace manager is admin (B1)", () => {
  assert.equal(isWorkspaceAdmin(["workspace:manager"]), true);
});

test("org owner is admin", () => {
  assert.equal(isWorkspaceAdmin(["org:owner", "workspace:member"]), true);
});

test("org manager is NOT admin (excluded from the admin set)", () => {
  assert.equal(isWorkspaceAdmin(["org:manager"]), false);
});

test("non-admin governance roles are not admin", () => {
  assert.equal(isWorkspaceAdmin(["workspace:member"]), false);
  assert.equal(isWorkspaceAdmin(["workspace:readonly"]), false);
  assert.equal(isWorkspaceAdmin(["workspace:guest"]), false);
});

test("bare unprefixed role is not admin (platform always prefixes)", () => {
  assert.equal(isWorkspaceAdmin(["owner"]), false);
});

test("case and surrounding whitespace are tolerated", () => {
  assert.equal(isWorkspaceAdmin([" Workspace:Owner "]), true);
});

test("empty / absent roles fail closed", () => {
  assert.equal(isWorkspaceAdmin([]), false);
  assert.equal(isWorkspaceAdmin(undefined), false);
  assert.equal(isWorkspaceAdmin(null), false);
});
