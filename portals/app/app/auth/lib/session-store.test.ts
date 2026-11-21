import { test } from "node:test";
import assert from "node:assert/strict";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { withSessionLock, createSession, getIdentity, getTokens, destroyBySid, putRotatedSession,
  type IdentityClaims, type TokenBundle } from "./session-store";
import type { OidcConfig } from "./config";

// Explicit isolated Redis only; never point this test at a product database.
test("concurrent resolution waits; global logout deletes all sessions and refresh cannot revive them",
  { skip: !process.env.ARDA_TEST_REDIS_URL }, async () => {
    const cfg = { redisUrl: process.env.ARDA_TEST_REDIS_URL!, sessionTtlSeconds: 120 } as OidcConfig;
    const observer = new Redis(cfg.redisUrl);
    const identity = { sub: "test-user", sid: `test-${randomUUID()}` } as IdentityClaims;
    const tokens = { access_token: "test-only", refresh_token: "test-only", access_exp: 100 } as TokenBundle;
    try {
      const first = await createSession(cfg, identity, tokens);
      const second = await createSession(cfg, identity, tokens);
      let rotations = 0;
      const resolve = () => withSessionLock(cfg, first, async () => {
        const stored = await getTokens(cfg, first);
        if (stored!.access_exp === 100) {
          rotations++;
          await delay(150);
          await putRotatedSession(cfg, first, identity, { ...tokens, access_exp: 200 });
        }
        return (await getTokens(cfg, first))!.access_exp;
      });
      assert.deepEqual(await Promise.all([resolve(), resolve(), resolve()]), [200, 200, 200]);
      assert.equal(rotations, 1);
      assert.ok(await observer.ttl(`rpsess:${first}`) <= 120);
      assert.equal(await destroyBySid(cfg, identity.sid), 2);
      assert.equal(await destroyBySid(cfg, identity.sid), 0);
      for (const id of [first, second]) {
        assert.equal(await getIdentity(cfg, id), null);
        assert.equal(await getTokens(cfg, id), null);
      }
      await assert.rejects(putRotatedSession(cfg, first, identity, tokens), /session_ended/);
      assert.equal(await getIdentity(cfg, first), null);
    } finally {
      await observer.quit();
      // Run with node --test-force-exit: session-store holds its runtime client.
    }
  });
