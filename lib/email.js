// ============================================================================
// Email validation — the *format* check is shared by the signup form (client)
// and the /api/auth/signup route handler (server), same as lib/password.js.
// ----------------------------------------------------------------------------
// "Valid domain" has two layers:
//   1. Syntax — handled here, runs in both places. Not RFC-perfect (that's
//      impractical), but requires a local part, an @, and a domain with at
//      least one dot-separated label after it (i.e. a real TLD, so "a@b" and
//      "a@b." are rejected).
//   2. Existence — whether the domain can actually receive mail. That needs a
//      DNS lookup, which is server-only, so it lives in the route handler.
// ============================================================================

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function validateEmailFormat(email) {
  const value = typeof email === "string" ? email.trim() : "";
  return EMAIL_RE.test(value);
}

// Returns the lowercased domain portion ("you@Example.com" -> "example.com"),
// or "" if there's no @.
export function getEmailDomain(email) {
  const value = typeof email === "string" ? email.trim() : "";
  const at = value.lastIndexOf("@");
  return at === -1 ? "" : value.slice(at + 1).toLowerCase();
}
