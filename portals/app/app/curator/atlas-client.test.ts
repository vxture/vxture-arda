import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CuratorAtlasClient, DEFAULT_ATLAS_CHAT_PATH, AtlasRequestError } from "./atlas-client";
import { Rfc8693TokenSource } from "./atlas-token";
import type { OidcConfig } from "../auth/lib/config";

test("Atlas exchange uses Basic, verified scope and exact trusted workspace binding", async () => {
  const now = Math.floor(Date.now() / 1000);
  const cfg = { clientId: "arda", clientSecret: "qa-only", endpoints: {
    token: "http://127.0.0.1/oidc/token" } } as OidcConfig;
  const claims = { aud: "atlas", scope: "tool:atlas", act: { sub: "arda" },
    mode: "service", org_id: "o1", workspace_id: "w1", iat: now, exp: now + 300 };
  const fetcher: typeof fetch = async (_url, init) => {
    const form = new URLSearchParams(String(init?.body));
    assert.equal(form.get("audience"), "atlas");
    assert.equal(form.get("workspace_id"), "w1");
    assert.equal(form.has("client_secret"), false);
    assert.match(new Headers(init?.headers).get("Authorization")!, /^Basic /);
    return Response.json({ access_token: "signed-atlas", token_type: "Bearer" });
  };
  const source = new Rfc8693TokenSource(cfg, fetcher, async () => claims);
  assert.equal(await source.tokenFor({ org: "o1", ws: "w1" }), "signed-atlas");
  for (const change of [{ aud: "vxture" }, { workspace_id: "other" }, { scope: "mgmt:atlas" },
    { act: { sub: "karda" } }, { sub: "user1" }, { exp: now + 301 }]) {
    const invalid = new Rfc8693TokenSource(cfg, fetcher, async () => ({ ...claims, ...change }));
    await assert.rejects(invalid.tokenFor({ org: "o1", ws: "w1" }), /scope_invalid/);
  }
});

const request = { tenantId: "o1", workspaceId: "w1", taskId: "task1",
  endpointCode: "granted-route", messages: [{ role: "user" as const, content: "Describe a table" }] };
const config = { baseUrl: "http://127.0.0.1:8082", chatPath: DEFAULT_ATLAS_CHAT_PATH,
  tokenSource: { tokenFor: async ({ org, ws }: { org: string; ws: string }) => {
    assert.equal(org, "o1"); assert.equal(ws, "w1"); return "signed-atlas";
  } } };
test("Atlas generation uses current route, bounded non-streaming call and no duplicate AI report", async () => {
  let calls = 0;
  const client = new CuratorAtlasClient(config, async (url, init) => {
    calls++;
    assert.equal(url, "http://127.0.0.1:8082/v1/chat");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.taskId, "task1");
    assert.equal(body.endpointCode, "granted-route");
    assert.equal(body.timeoutMs, 60_000);
    assert.equal(body.stream, false);
    return Response.json({ message: { content: "answer", reasoning_content: "private reasoning" } });
  });
  assert.deepEqual(await client.chat(request), { content: "answer" });
  assert.equal(calls, 1);
  await assert.rejects(client.chat({ ...request, workspaceId: "" }), /context_required/);
  await assert.rejects(client.chat({ ...request, modelCode: "conflict" }), /route_required/);
});
test("quota and transient rate-limit errors keep their distinct status/code/retry contract", async () => {
  for (const [status, code, retryable] of [[403, "QUOTA_EXCEEDED", false], [429, "RATE_LIMITED", true]] as const) {
    const client = new CuratorAtlasClient(config, async () => Response.json({ code, retryable, retryAfterMs: 500 }, { status }));
    await assert.rejects(client.chat(request), error => error instanceof AtlasRequestError
      && error.status === status && error.code === code && error.retryable === retryable && error.retryAfterMs === 500);
  }
});
