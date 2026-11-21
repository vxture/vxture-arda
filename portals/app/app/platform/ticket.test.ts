import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PlatformTicketSource, validatePlatformClaims, type PlatformContext } from "./ticket";
import { parseProductAccess } from "./access";
import type { OidcConfig } from "../auth/lib/config";

const context: PlatformContext = { orgId: "o1", workspaceId: "w1" };
const obo = { ...context, subject: "usr_1", subjectToken: "private-user-token" };
const claims = { aud: "vxture", act: { sub: "arda" }, org_id: "o1", workspace_id: "w1",
  mode: "service", scope: "tool:vxture", iat: 1000, exp: 1300 };

test("tickets bind actor, workspace, organization, mode, audience and bounded expiry", () => {
  validatePlatformClaims(claims, context, 1100);
  for (const change of [{ aud: "atlas" }, { act: { sub: "karda" } }, { org_id: "o2" },
    { workspace_id: "w2" }, { delegated: true }, { mode: "obo" }, { sub: "usr_1" },
    { exp: 1400 }, { exp: 1100 }, { iat: 1200 }, { scope: "tool:arda" }]) {
    assert.throws(() => validatePlatformClaims({ ...claims, ...change }, context, 1100));
  }
  validatePlatformClaims({ ...claims, mode: "obo", sub: "usr_1" }, obo, 1100);
  assert.throws(() => validatePlatformClaims({ ...claims, mode: "obo", sub: "usr_2" }, obo, 1100));
});

test("OBO exchange sends only the subject token context, uses Basic and validates before returning", async () => {
  const now = Math.floor(Date.now() / 1000);
  const cfg = { clientId: "arda", clientSecret: "test-secret", endpoints: { token: "http://127.0.0.1/oidc/token" } } as OidcConfig;
  let called = false;
  const fetcher: typeof fetch = async (_url, options) => {
    called = true;
    const form = new URLSearchParams(String(options?.body));
    assert.equal(form.get("subject_token"), obo.subjectToken);
    assert.equal(form.get("audience"), "vxture");
    assert.equal(form.has("org_id"), false);
    assert.equal(form.has("workspace_id"), false);
    assert.equal(form.has("client_secret"), false);
    assert.match(new Headers(options?.headers).get("Authorization")!, /^Basic /);
    assert.equal(options?.redirect, "error");
    return Response.json({ token_type: "Bearer", access_token: "signed-ticket" });
  };
  const source = new PlatformTicketSource(cfg, fetcher, async () => ({ ...claims, iat: now, exp: now + 300, mode: "obo", sub: "usr_1" }));
  assert.equal(await source.tokenFor(obo), "signed-ticket");
  assert.equal(called, true);
  const wrong = new PlatformTicketSource(cfg, fetcher, async () => ({ ...claims, iat: now, exp: now + 300 }));
  await assert.rejects(wrong.tokenFor(obo), /scope_invalid/);
});

test("product assignment cannot cross users or be inferred from workspace membership", () => {
  const response = { product: "arda", subject: "usr_1", org_id: "o1", workspace_id: "w1", allowed: false };
  assert.equal(parseProductAccess(response, obo), false);
  assert.equal(parseProductAccess({ ...response, allowed: true }, obo), true);
  for (const change of [{ subject: "usr_2" }, { workspace_id: "w2" }, { org_id: "o2" }, { product: "karda" }, { allowed: "true" }]) {
    assert.throws(() => parseProductAccess({ ...response, ...change }, obo));
  }
  assert.throws(() => parseProductAccess(response, context));
});
