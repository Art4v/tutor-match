// ============================================================================
// Quick join (0076, opened to everyone in 0077): shared constants, safe to
// import anywhere.
// ----------------------------------------------------------------------------
// /quick-join is the public page where a tutor signs up and lets MatchTutor
// set up and manage their profile. It is a static file outside the middleware
// matcher, so a crawler loading it costs no function run and no Supabase
// query. There is no key: the durable per-IP limit in
// consume_quick_join_attempt (0077) is what holds back bot signups.
// ============================================================================

export const JOIN_PATH = "/quick-join";
export const JOIN_DETAILS_PATH = "/quick-join/details";
// Confirmation emails sent before the move still carry this as their `next`.
export const LEGACY_JOIN_DETAILS_PATH = "/join/details";

/** Is `next` the documents step (current or pre-0077 path)? */
export function isJoinDetailsNext(next) {
  return typeof next === "string" && (next.startsWith(JOIN_DETAILS_PATH) || next.startsWith(LEGACY_JOIN_DETAILS_PATH));
}

// Marks a Google sign-in started on /quick-join, which leaves the site
// mid-flow. httpOnly, short-lived, read once by /auth/callback. It holds no
// secret; the consent it stands for was checked when it was set.
export const INVITE_COOKIE = "tutor_invite";
export const INVITE_COOKIE_MAX_AGE = 30 * 60; // seconds

// Signup materials (private, admin-only). Same file rules as public documents.
export const MAX_INVITE_DOCS = 5;
export const MAX_INVITE_LINKS = 5;
export const MAX_LINK_LENGTH = 500;
