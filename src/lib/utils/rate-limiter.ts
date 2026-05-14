/**
 * In-memory rate limiter — token bucket per key (typically IP address).
 *
 * Designed for single-tenant Next.js deployments where a horizontally-scaled
 * Redis-backed limiter would be overkill. The bucket survives within a single
 * Node process; if you scale to multiple replicas each replica gets its own
 * bucket (which is fine for the relatively small abuse threats this protects
 * against — public PDF download brute-force and verify-portal spam).
 *
 * Usage:
 *   const rl = createRateLimiter({ capacity: 60, refillPerSecond: 60 / 60 });
 *   const allowed = rl.consume(ipAddress);
 *   if (!allowed) return new NextResponse('Too Many Requests', { status: 429 });
 *
 * Eviction:
 *   Buckets are LRU-cleaned every CLEANUP_EVERY_MS ms — entries idle for
 *   longer than 1 hour are dropped to keep memory bounded.
 */

interface Bucket {
  tokens: number;
  lastRefill: number; // ms timestamp
}

export interface RateLimiterOptions {
  /** Max tokens (= max burst). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
  /** Max idle time before bucket is evicted (default 1 hour). */
  maxIdleMs?: number;
}

export interface RateLimiter {
  /** Try to consume 1 token. Returns true if allowed, false if rate-limited. */
  consume: (key: string) => boolean;
  /** Diagnostic: get remaining tokens without consuming (debug only). */
  remaining: (key: string) => number;
  /** Clear all buckets (test helper). */
  clear: () => void;
}

const CLEANUP_EVERY_MS = 60_000;

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const capacity = Math.max(1, Math.floor(opts.capacity));
  const refill = Math.max(0.0001, opts.refillPerSecond);
  const maxIdle = opts.maxIdleMs ?? 60 * 60 * 1000;
  const buckets = new Map<string, Bucket>();
  let lastCleanup = Date.now();

  function cleanup(now: number) {
    if (now - lastCleanup < CLEANUP_EVERY_MS) return;
    lastCleanup = now;
    for (const [k, b] of buckets) {
      if (now - b.lastRefill > maxIdle) buckets.delete(k);
    }
  }

  function refillBucket(b: Bucket, now: number) {
    const elapsedSec = Math.max(0, (now - b.lastRefill) / 1000);
    if (elapsedSec <= 0) return;
    b.tokens = Math.min(capacity, b.tokens + elapsedSec * refill);
    b.lastRefill = now;
  }

  return {
    consume(key: string): boolean {
      const now = Date.now();
      cleanup(now);
      let b = buckets.get(key);
      if (!b) {
        b = { tokens: capacity, lastRefill: now };
        buckets.set(key, b);
      }
      refillBucket(b, now);
      if (b.tokens < 1) return false;
      b.tokens -= 1;
      return true;
    },
    remaining(key: string): number {
      const now = Date.now();
      const b = buckets.get(key);
      if (!b) return capacity;
      refillBucket(b, now);
      return Math.floor(b.tokens);
    },
    clear(): void {
      buckets.clear();
    },
  };
}

// ----------------------------------------------------------------------------
// Shared limiters used across the public COA verify endpoints.
// ----------------------------------------------------------------------------

/** 60 req/min per IP — used by /api/coa/verify/[token]/pdf to deter brute force. */
export const PUBLIC_VERIFY_PDF_LIMITER = createRateLimiter({
  capacity: 60,
  refillPerSecond: 60 / 60, // = 1 token / second → 60 / minute
});
