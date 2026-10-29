// ============================================================================
// Tutor invite page (0076): shared constants, safe to import anywhere.
// ----------------------------------------------------------------------------
// One universal link, /join?k=<key>. The key lives in tutor_invite_key (admin
// read + rotate only) and is checked on SUBMIT, never on page load: /join is a
// static file outside the middleware matcher, so a crawler loading it costs no
// function run and no Supabase query. See the 0076 header and CLAUDE.md.
// ============================================================================

export const JOIN_PATH = "/join";
export const JOIN_DETAILS_PATH = "/join/details";

// Carries the key across a Google sign-in, which leaves the site mid-flow.
// httpOnly, short-lived, read once by /auth/callback.
export const INVITE_COOKIE = "tutor_invite";
export const INVITE_COOKIE_MAX_AGE = 30 * 60; // seconds

// Shape of a key (matches the 0076 CHECK). A malformed key is refused before
// any database call.
export const INVITE_KEY_RE = /^[0-9a-f]{32}$/;

export function isInviteKey(value) {
  return typeof value === "string" && INVITE_KEY_RE.test(value);
}

export function tutorInviteUrl(origin, key) {
  return `${origin}${JOIN_PATH}?k=${encodeURIComponent(key)}`;
}

// Signup materials (private, admin-only). Same file rules as public documents.
export const MAX_INVITE_DOCS = 5;
export const MAX_INVITE_LINKS = 5;
export const MAX_LINK_LENGTH = 500;
