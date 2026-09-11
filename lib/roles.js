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
  // Partners resolve through /partner the same way tutors resolve through
  // /profile: the slug isn't known when these fixed URLs are constructed.
  if (role === "partner") return "/partner";
  return "/browse";
}

/**
 * Full post-auth destination including the chooser gate, for the flows that
 * resolve a role and immediately redirect (login, /auth/callback).
 */
export function postAuthDest(role) {
  return role == null ? "/choose-role" : homeFor(role);
}

/**
 * Sanitise a `?next=` destination before redirecting to it.
 *
 * Added for the partner invite flow: a centre clicking a claim link while
 * logged out has to round-trip through signup and come back, so the claim URL
 * rides along as `?next=`. Anything user-supplied that ends up in a redirect is
 * an open-redirect risk, so only same-origin absolute PATHS are allowed.
 *
 * Rejects: absolute URLs, protocol-relative "//evil.com" (which a browser
 * treats as a host, not a path), and anything not starting with "/".
 */
export function safeNext(next, fallback = null) {
  if (typeof next !== "string" || next === "") return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  return next;
}
