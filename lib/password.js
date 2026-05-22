// ============================================================================
// Password policy — single source of truth shared by the signup form (client)
// and the /api/auth/signup route handler (server).
// ----------------------------------------------------------------------------
// This module is deliberately framework-free (no "use client", no server-only
// imports) so the exact same rules run in both places. Client-side validation
// is for instant feedback; the server route is the authoritative gate that
// can't be bypassed by disabling JS or crafting a raw request.
// ============================================================================

export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "uppercase", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "One number", test: (p) => /[0-9]/.test(p) },
  {
    id: "special",
    label: "One special character",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

// Returns { valid, failed, passed }. `failed`/`passed` are arrays of the rule
// objects above so callers can render a per-requirement checklist.
export function validatePassword(password) {
  const pw = typeof password === "string" ? password : "";
  const passed = [];
  const failed = [];
  for (const rule of PASSWORD_RULES) {
    (rule.test(pw) ? passed : failed).push(rule);
  }
  return { valid: failed.length === 0, failed, passed };
}
