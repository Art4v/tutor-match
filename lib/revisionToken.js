// ============================================================================
// Signed profile-revision moderation tokens (SERVER-ONLY).
// ----------------------------------------------------------------------------
// The admin approves or rejects a verified tutor's submitted profile changes by
// clicking a link in their email. That link carries an HMAC-signed token
// instead of a session: possession of a valid token is the authorization (see
// app/api/profile-revisions/approve + reject and app/admin/profile-revision).
//
// Token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
// Payload is { r: revisionId, iat: epochSeconds }. Signed with
// PROFILE_REVISION_SECRET. Tokens older than MAX_AGE are rejected; the tutor
// can resend a fresh link once a day (/api/profile-revisions/resend).
//
// Deliberately a separate module + separate secret from lib/reviewToken.js,
// lib/verifyToken.js and lib/reportToken.js: independent link classes that must
// not be able to cross-authorize. The token names a REVISION, not a tutor, so
// an old link can only ever act on the submission it was sent for.
// ============================================================================

import crypto from "crypto";

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function secret() {
  const s = process.env.PROFILE_REVISION_SECRET;
  if (!s) throw new Error("PROFILE_REVISION_SECRET is not configured");
  return s;
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function sign(payloadB64) {
  return b64url(crypto.createHmac("sha256", secret()).update(payloadB64).digest());
}

/** Build a token for moderating `revisionId`. */
export function signRevisionToken(revisionId) {
  const payload = b64url(JSON.stringify({ r: revisionId, iat: Math.floor(Date.now() / 1000) }));
  return `${payload}.${sign(payload)}`;
}

/**
 * Validate a token. Returns { revisionId } on success or { error } on failure
 * ("malformed", "bad-signature" or "expired"). Uses a constant-time compare.
 */
export function verifyRevisionToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return { error: "malformed" };
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return { error: "malformed" };

  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { error: "bad-signature" };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  } catch {
    return { error: "malformed" };
  }
  if (!payload?.r) return { error: "malformed" };
  if (!Number.isFinite(payload.iat) || Date.now() / 1000 - payload.iat > MAX_AGE_SECONDS) {
    return { error: "expired" };
  }
  return { revisionId: payload.r };
}
