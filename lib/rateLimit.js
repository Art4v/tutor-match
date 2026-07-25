// ============================================================================
// Best-effort in-process rate limiter (SERVER-ONLY).
// ----------------------------------------------------------------------------
// A tiny fixed-window counter keyed by an arbitrary string (e.g. a client IP).
// State lives in a module-level Map, so it needs no DB, migration, or external
// service.
//
// CAVEAT: on serverless (Vercel) each lambda instance has its own module memory
// and instances are recycled, so this is a SOFT cap, not a hard guarantee. It's
// meant to blunt a naive flood from one client, not to be a security boundary.
// For the bug-report form the honeypot is the primary defense; this is backup.
// ============================================================================

// key -> array of request timestamps (ms) still inside the current window.
const hits = new Map();

/**
 * Record a hit for `key` and report whether it's within the allowance.
 * @param {string} key - identity to limit on (e.g. an IP address).
 * @param {{ limit: number, windowMs: number }} opts
 * @returns {{ allowed: boolean, retryAfterMs: number }}
 */
export function checkRateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  const cutoff = now - windowMs;

  const recent = (hits.get(key) || []).filter((t) => t > cutoff);

  if (recent.length >= limit) {
    // Oldest timestamp in the window frees up a slot once it ages out.
    const retryAfterMs = Math.max(0, recent[0] + windowMs - now);
    hits.set(key, recent);
    return { allowed: false, retryAfterMs };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, retryAfterMs: 0 };
}
