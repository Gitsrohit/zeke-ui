import { RateLimitError } from "@/lib/errors";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Fixed-window in-memory limiter. Suitable for a single instance; use a shared
 * store (e.g. Redis) when running more than one server.
 */
export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): void {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return;
  }
  bucket.count++;
  if (bucket.count > limit) throw new RateLimitError(Math.ceil((bucket.resetAt - now) / 1000));
}

export function resetRateLimits(): void {
  buckets.clear();
}
