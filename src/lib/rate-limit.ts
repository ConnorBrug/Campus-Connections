// Simple in-memory rate limiter for API routes.
// Tracks requests per key (IP or UID) within a sliding window.
//
// CAVEAT: this is a per-process Map. On Vercel/Cloud Run/any multi-
// instance deploy each lambda/container keeps its own counter, so the
// effective limit is `limit * numberOfInstances`. For abuse-sensitive
// endpoints use `isRateLimitedDurable` below instead.

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
 * Check if a request is rate-limited (in-memory, per-process).
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

/**
 * Durable, cross-instance rate limiter backed by Firestore.
 *
 * The in-memory `isRateLimited` above is per-process, so on serverless each
 * instance keeps its own counter and the effective limit is `limit ×
 * instances`. For abuse-sensitive endpoints (session minting, account
 * deletion) use this instead: it stores a fixed-window counter in
 * `rateLimits/{key}` so the limit is enforced globally.
 *
 * Fails OPEN (returns false) on any Firestore error so an infra hiccup can't
 * lock every user out of signing in.
 */
export async function isRateLimitedDurable(
  key: string,
  limit: number,
  windowMs: number = 60_000,
): Promise<boolean> {
  const { adminDb } = await import('./firebase-admin');
  const ref = adminDb.collection('rateLimits').doc(key.replace(/[/]/g, '_'));
  const now = Date.now();

  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists
        ? (snap.data() as { windowStart?: number; count?: number })
        : null;

      if (!data?.windowStart || now - data.windowStart >= windowMs) {
        tx.set(ref, { windowStart: now, count: 1, updatedAt: now });
        return false;
      }

      const count = (data.count ?? 0) + 1;
      tx.update(ref, { count, updatedAt: now });
      return count > limit;
    });
  } catch (e) {
    console.error('[isRateLimitedDurable] failed; failing open', e);
    return false;
  }
}
