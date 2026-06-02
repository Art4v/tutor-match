// ============================================================================
// Mail-domain existence check — server-only DNS lookup shared by the auth
// routes (/api/auth/signup and /api/auth/forgot-password).
// ----------------------------------------------------------------------------
// Email *format* validation lives in lib/email.js (runs on client + server).
// This module answers the deeper question — can the domain actually receive
// mail? — which needs DNS and therefore only runs on the server.
// ============================================================================

import dns from "node:dns/promises";

// Does the domain actually exist and accept mail? A deliverable domain has MX
// records; some smaller domains accept mail via an implicit MX (their A/AAAA
// record), so we fall back to that. A typo'd domain ("gmial.con") resolves to
// neither and is rejected. Returns false on any lookup failure.
export async function domainCanReceiveMail(domain) {
  try {
    const mx = await dns.resolveMx(domain);
    if (mx.length > 0) return true;
  } catch {
    // No MX records (or NXDOMAIN) — fall through to the A/AAAA check.
  }
  try {
    await dns.lookup(domain);
    return true;
  } catch {
    return false;
  }
}
