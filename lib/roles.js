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
  return role === "tutor" ? "/profile" : "/browse";
}

/**
 * Full post-auth destination including the chooser gate, for the flows that
 * resolve a role and immediately redirect (login, /auth/callback).
 */
export function postAuthDest(role) {
  return role == null ? "/choose-role" : homeFor(role);
}
