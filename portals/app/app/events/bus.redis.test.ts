import { test } from "node:test";
import assert from "node:assert/strict";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { EventBus, workspaceTarget, sessionTarget, type Invalidation } from "./bus";
import { createSession, destroyBySid, destroySession, getIdentity, putRotatedSession, closeSessionStore,
  type IdentityClaims, type TokenBundle } from "../auth/lib/session-store";
import type { OidcConfig } from "../auth/lib/config";

const endpoint = process.env.ARDA_TEST_REDIS_URL;
test("real Redis: two replicas, missed/late invalidations, restore and atomic revocation", { skip: !endpoint }, async () => {
  const url = new URL(endpoint!);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.equal(url.pathname, "/15");
  const cid = `arda-access-${randomUUID()}`;
  const first = new EventBus(endpoint!, cid), second = new EventBus(endpoint!, cid);
  const foreign = new EventBus(endpoint!, `${cid}-beta`);
  const observer = new Redis(endpoint!);
  const seen: Invalidation[] = [], other: Invalidation[] = [];
  let stop = () => {}, stopOther = () => {};
  const settle = () => new Promise(resolve => setTimeout(resolve, 50));
  const cfg = { clientId: cid, redisUrl: endpoint!, sessionTtlSeconds: 120 } as OidcConfig;
  const identity = { sid: `sid-${randomUUID()}`, sub: "test-user" } as IdentityClaims;
  const tokens = { access_token: "test-only", refresh_token: "test-only", access_exp: 100 } as TokenBundle;
  const sessions: string[] = [];
  try {
    stop = await second.listen(event => seen.push(event), () => {});
    stopOther = await foreign.listen(event => other.push(event), () => {});
    assert.equal(await second.version("ws-one"), "0");
    await first.publishWorkspace("ws-one", "1"); await settle();
    assert.equal(seen.length, 1);
    assert.equal(seen[0].target, workspaceTarget("ws-one"));
    assert.equal(other.length, 0);
    assert.equal(await second.version("ws-other"), "0");
    stop(); await first.publishWorkspace("ws-one", "2");
    assert.equal(await second.version("ws-one"), "2", "missed messages recover from a version snapshot");
    stop = await second.listen(event => seen.push(event), () => {});
    await first.publishWorkspace("ws-one", "3"); await settle();
    const count = seen.length;
    await first.publishWorkspace("ws-one", "3");
    await first.publishWorkspace("ws-one", "1"); await settle();
    assert.equal(seen.length, count);
    const restored = new EventBus(endpoint!, cid, async () => "8");
    try {
      assert.equal(await restored.version("redis-lost"), "8");
      await first.publishWorkspace("redis-lost", "7");
      assert.equal(await restored.version("redis-lost"), "8");
    } finally { await restored.close(); }
    sessions.push(await createSession(cfg, identity, tokens), await createSession(cfg, identity, tokens));
    assert.equal(await destroyBySid(cfg, identity.sid), 2);
    await settle();
    for (const id of sessions) {
      assert.equal(await getIdentity(cfg, id), null);
      assert.ok(seen.some(event => event.kind === "revoked" && event.target === sessionTarget(id)));
      await assert.rejects(putRotatedSession(cfg, id, identity, tokens), /session_ended/);
    }
    assert.equal(await destroyBySid(cfg, identity.sid), 0);
    const local = await createSession(cfg, identity, tokens); sessions.push(local);
    await destroySession(cfg, local); await settle();
    assert.ok(seen.some(event => event.target === sessionTarget(local) && event.kind === "revoked"));
  } finally {
    for (const id of sessions) await destroySession(cfg, id);
    stop(); stopOther();
    await Promise.all([first.close(), second.close(), foreign.close(), closeSessionStore()]);
    for (const key of await observer.keys(`vx:rp:${cid}*`)) await observer.del(key);
    await observer.quit();
  }
});
