export interface InMemoryRateLimitOptions {
  windowMs: number;
  maxRequests: number;
  /** Hard memory bound. New keys are denied when the live-key limit is reached. */
  maxBuckets?: number;
  /** Opportunistic cleanup cadence; capacity sweeps are throttled to this cadence. */
  cleanupEvery?: number;
  now?: () => number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Process-local, bounded fixed-window limiter.
 *
 * This is defence-in-depth for a single process, not a distributed limiter.
 * Production must also enforce limits at a trusted edge or shared store.
 */
export function createInMemoryRateLimiter(options: InMemoryRateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    maxBuckets = 10_000,
    cleanupEvery = 256,
    now = Date.now,
  } = options;

  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error("windowMs must be a positive finite number");
  }
  if (!Number.isInteger(maxRequests) || maxRequests < 1) {
    throw new Error("maxRequests must be a positive integer");
  }
  if (!Number.isInteger(maxBuckets) || maxBuckets < 1) {
    throw new Error("maxBuckets must be a positive integer");
  }
  if (!Number.isInteger(cleanupEvery) || cleanupEvery < 1) {
    throw new Error("cleanupEvery must be a positive integer");
  }

  const buckets = new Map<string, { count: number; resetAt: number }>();
  let calls = 0;
  let lastCleanupCall = 0;

  function removeExpired(at: number) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= at) buckets.delete(key);
    }
    lastCleanupCall = calls;
  }

  return function consume(key: string): RateLimitDecision {
    const at = now();
    calls += 1;
    if (calls % cleanupEvery === 0) removeExpired(at);

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= at) {
      if (!bucket && buckets.size >= maxBuckets) {
        // At capacity, do not scan the whole map for every attacker-controlled new key.
        // A full sweep is permitted only at the configured cleanup cadence.
        if (calls - lastCleanupCall >= cleanupEvery) removeExpired(at);
        if (buckets.size >= maxBuckets) {
          return { allowed: false, remaining: 0, resetAt: at + windowMs };
        }
      }
      bucket = { count: 1, resetAt: at + windowMs };
      buckets.set(key, bucket);
      return { allowed: true, remaining: maxRequests - 1, resetAt: bucket.resetAt };
    }

    if (bucket.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    }

    bucket.count += 1;
    return {
      allowed: true,
      remaining: maxRequests - bucket.count,
      resetAt: bucket.resetAt,
    };
  };
}
