import assert from "node:assert/strict";
import { test } from "node:test";
import { WINDOW_MS, decide, limitPerMinute } from "./rate-limit";

test("decide allows up to the limit and blocks beyond it", () => {
  const now = 120_000; // exactly on a window boundary
  assert.equal(decide(1, 2, now).allowed, true);
  assert.equal(decide(2, 2, now).allowed, true);
  assert.equal(decide(3, 2, now).allowed, false);
});

test("decide reports remaining and a retry-after within the window", () => {
  const windowStart = 10 * WINDOW_MS;
  const d = decide(5, 10, windowStart + 15_000);
  assert.equal(d.remaining, 5);
  assert.equal(d.retryAfterSeconds, 45);

  const exhausted = decide(11, 10, windowStart + 59_500);
  assert.equal(exhausted.remaining, 0);
  assert.equal(exhausted.retryAfterSeconds, 1);
});

test("limitPerMinute reads the env override and rejects garbage", () => {
  const prev = process.env.API_RATE_LIMIT_PER_MINUTE;
  try {
    delete process.env.API_RATE_LIMIT_PER_MINUTE;
    assert.equal(limitPerMinute(), 120);
    process.env.API_RATE_LIMIT_PER_MINUTE = "30";
    assert.equal(limitPerMinute(), 30);
    process.env.API_RATE_LIMIT_PER_MINUTE = "nope";
    assert.equal(limitPerMinute(), 120);
    process.env.API_RATE_LIMIT_PER_MINUTE = "-1";
    assert.equal(limitPerMinute(), 120);
  } finally {
    if (prev === undefined) delete process.env.API_RATE_LIMIT_PER_MINUTE;
    else process.env.API_RATE_LIMIT_PER_MINUTE = prev;
  }
});
