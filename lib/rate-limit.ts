// Fixed-window rate limiter, in-process.
//
// SCOPE AND LIMITS — read before relying on this:
// State lives in the memory of a single serverless instance. Vercel reuses warm
// instances aggressively, so this reliably stops the case it is here for: one
// client hammering an endpoint in a loop. It does NOT give a global guarantee —
// a caller spread across many cold instances gets a higher effective ceiling.
// For a hard global limit, back this with Redis (Upstash) and keep the same
// call signature; nothing else in the codebase needs to change.
//
// It is a second line of defence. The primary controls are the parse-credit
// gate in /api/analyze and the hasFullAccess gate in /api/apply-full.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Hard ceiling on tracked keys so a long-lived instance cannot grow unbounded.
const MAX_KEYS = 5000;

// Map.forEach and Array.from are used instead of for..of / spread because the
// project compiles with target es5, where iterating a Map directly requires
// downlevelIteration. Deleting during forEach is well-defined.
function sweep(now: number): void {
  const expired: string[] = [];
  buckets.forEach((bucket, key) => {
    if (now >= bucket.resetAt) expired.push(key);
  });
  for (let i = 0; i < expired.length; i++) buckets.delete(expired[i]);

  // Still oversized after dropping expired entries (a burst of unique users):
  // drop the soonest-expiring keys until back under the cap. Losing a window
  // early only ever grants a caller extra headroom — it can never wrongly block.
  if (buckets.size > MAX_KEYS) {
    const entries: Array<[string, Bucket]> = [];
    buckets.forEach((bucket, key) => { entries.push([key, bucket]); });
    entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
    const excess = entries.length - MAX_KEYS;
    for (let i = 0; i < excess; i++) buckets.delete(entries[i][0]);
  }
}

export type RateLimitResult = { ok: boolean; retryAfter: number };

/**
 * @param key       caller identity + route, e.g. `analyze:${userId}`
 * @param limit     requests permitted per window
 * @param windowMs  window length in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_KEYS) sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}
