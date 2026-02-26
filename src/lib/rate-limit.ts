// Simple in-memory rate limiter for API routes.
// Tracks requests per key (IP or UID) within a sliding window.

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
