import test from "node:test";
import assert from "node:assert/strict";
import { createInMemoryRateLimiter } from "../server/inMemoryRateLimiter";

test("allows the configured number of requests and blocks the next request", () => {
  let now = 1_000;
  const limit = createInMemoryRateLimiter({ windowMs: 60_000, maxRequests: 2, now: () => now });

  assert.deepEqual(limit("client-a"), { allowed: true, remaining: 1, resetAt: 61_000 });
  assert.deepEqual(limit("client-a"), { allowed: true, remaining: 0, resetAt: 61_000 });
  assert.deepEqual(limit("client-a"), { allowed: false, remaining: 0, resetAt: 61_000 });

  now = 61_000;
  assert.deepEqual(limit("client-a"), { allowed: true, remaining: 1, resetAt: 121_000 });
});

test("isolates counters by key", () => {
  const limit = createInMemoryRateLimiter({ windowMs: 1_000, maxRequests: 1, now: () => 10 });
  assert.equal(limit("client-a").allowed, true);
  assert.equal(limit("client-b").allowed, true);
  assert.equal(limit("client-a").allowed, false);
});

test("bounds key growth and reclaims expired capacity on the cleanup cadence", () => {
  let now = 100;
  const limit = createInMemoryRateLimiter({
    windowMs: 50,
    maxRequests: 5,
    maxBuckets: 2,
    cleanupEvery: 4,
    now: () => now,
  });

  assert.equal(limit("a").allowed, true);
  assert.equal(limit("b").allowed, true);
  assert.equal(limit("c").allowed, false, "must fail closed rather than grow beyond maxBuckets");
  assert.equal(limit("d").allowed, false, "capacity sweeps must be throttled rather than run for every new key");

  now = 150;
  assert.equal(limit("e").allowed, false, "expired capacity may remain fail-closed until the next bounded cleanup sweep");
  assert.equal(limit("f").allowed, false);
  assert.equal(limit("g").allowed, false);
  assert.equal(limit("h").allowed, true, "the scheduled cleanup sweep reclaims expired buckets");
});

test("rejects invalid configuration", () => {
  assert.throws(() => createInMemoryRateLimiter({ windowMs: 0, maxRequests: 1 }));
  assert.throws(() => createInMemoryRateLimiter({ windowMs: 1_000, maxRequests: 0 }));
  assert.throws(() => createInMemoryRateLimiter({ windowMs: 1_000, maxRequests: 1, maxBuckets: 0 }));
});
