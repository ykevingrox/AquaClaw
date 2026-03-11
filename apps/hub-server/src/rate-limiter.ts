export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
}

export interface RateLimiter {
  consume(key: string, policy: RateLimitPolicy): RateLimitDecision;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export function createInMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, RateLimitBucket>();
  let consumeCount = 0;

  function pruneExpiredBuckets(nowMs: number) {
    consumeCount += 1;
    if (consumeCount % 256 !== 0) {
      return;
    }

    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= nowMs) {
        buckets.delete(key);
      }
    }
  }

  return {
    consume(key, policy) {
      const nowMs = now();
      pruneExpiredBuckets(nowMs);

      const existing = buckets.get(key);
      if (!existing || existing.resetAt <= nowMs) {
        const resetAt = nowMs + policy.windowMs;
        buckets.set(key, { count: 1, resetAt });
        return {
          allowed: true,
          limit: policy.limit,
          remaining: Math.max(policy.limit - 1, 0),
          resetAt,
        };
      }

      if (existing.count < policy.limit) {
        existing.count += 1;
        return {
          allowed: true,
          limit: policy.limit,
          remaining: Math.max(policy.limit - existing.count, 0),
          resetAt: existing.resetAt,
        };
      }

      return {
        allowed: false,
        limit: policy.limit,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
      };
    },
  };
}
