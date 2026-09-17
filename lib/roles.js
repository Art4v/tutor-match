// ============================================================================
// Role-based routing. profiles.role (0041) is the source of truth; NULL means
// the account hasn't picked a role yet and must pass through /choose-role.
// ============================================================================

/**
 * Where a signed-in user belongs when they land somewhere with nothing to show
 * them: a tutor on their own profile, a student on the tutor list. Every
 * post-auth redirect goes through here so they can't drift apart.
 *
 * Pass a NULL/undefined role only if you've already handled the chooser gate —
 * this treats "no role" as a student, which is a safe default (the tutor
 * surfaces would 404) but not the correct destination for a mid-signup user.
 */
export function homeFor(role) {
  if (role === "tutor") return "/profile";
  // Companies resolve through /company the same way tutors resolve through
  // /profile: the slug isn't known when these fixed URLs are constructed.
  if (role === "partner") return "/company";
  return "/browse";
}

/**
 * Full post-auth destination including the chooser gate, for the flows that
 * resolve a role and immediately redirect (login, /auth/callback).
 */
export function postAuthDest(role) {
  return role == null ? "/choose-role" : homeFor(role);
}

// Throwaway base for the normalisation below. A reserved `.invalid` host (RFC
// 2606) so it can never be a real destination, the same trick the shadow
// company-tutor addresses use.
const SAFE_NEXT_BASE = "http://next.invalid";

/**
 * Sanitise a `?next=` destination before redirecting to it.
 *
 * Added for the company invite flow: a company clicking a claim link while
 * logged out has to round-trip through signup and come back, so the claim URL
 * rides along as `?next=`. Anything user-supplied that ends up in a redirect is
 * an open-redirect risk, so only same-origin absolute PATHS are allowed.
 *
 * NORMALISE, DON'T BLOCKLIST. This used to reject "//evil.com" by prefix, which
 * missed "/\evil.com": the URL spec treats "\" as "/" for http(s), so a browser
 * reads that as an AUTHORITY too, and `new URL("/\\evil.com", origin)` resolves
 * to https://evil.com. That mattered because Next's router.push() resolves its
 * argument with exactly that call, classifies the result as external, and hard
 * navigates to it — so /login?next=/\evil.com sent a user who had JUST typed
 * their password to an attacker's page, from a real first-party URL.
 *
 * Leading control characters ("/\tevil") are stripped by the parser before any
 * prefix check can see them, so a blocklist has to guess every spelling. Instead
 * resolve against a throwaway origin and require the result to have stayed on
 * it: every "this is really a host" spelling changes the origin, in one check.
 * Returning the parsed pieces rather than the raw string also means what ships
 * to the redirect is what the parser saw, not a different reading of it.
 *
 * Rejects: absolute URLs, anything not starting with "/" (a bare "foo" would
 * otherwise be promoted to "/foo"), and anything that resolves off-origin.
 */
export function safeNext(next, fallback = null) {
  if (typeof next !== "string" || next === "") return fallback;
  if (!next.startsWith("/")) return fallback;

  let url;
  try {
    url = new URL(next, SAFE_NEXT_BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== SAFE_NEXT_BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
