// Simple in-memory rate limiter for API routes.
// Tracks requests per key (IP or UID) within a sliding window.
//
// CAVEAT: this is a per-process Map. On Vercel/Cloud Run/any multi-
// instance deploy each lambda/container keeps its own counter, so the
// effective limit is `limit * numberOfInstances`. That's fine for the
// current scale (small app, cold-start dominated) but if we ever need a
// hard guarantee - abuse throttle, paid-tier quotas, etc. - swap this
// out for Upstash Redis or Firestore-backed counters. Also note that
// the setInterval-based cleanup below only runs while the process is
// warm; short-lived lambdas rely on the filter inside isRateLimited to
// prune old timestamps.

const store = new Map<string, number[]>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [key, timestamps] of store) {
    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) store.delete(key);
    else store.set(key, filtered);
  }
}, 300_000);

/**
 * Check if a request is rate-limited.
 * @param key - Unique identifier (e.g. IP address or user ID)
 * @param limit - Max requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60s)
 * @returns true if the request should be rejected
 */
export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;

  const timestamps = (store.get(key) ?? []).filter((t) => t > cutoff);
  timestamps.push(now);
  store.set(key, timestamps);

  return timestamps.length > limit;
}
