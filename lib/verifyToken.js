// ============================================================================
// Signed verification-approval tokens (SERVER-ONLY).
// ----------------------------------------------------------------------------
// The admin approves a tutor by clicking a link in their email. That link
// carries an HMAC-signed token instead of a session — possession of a valid
// token is the authorization (see app/api/verification/approve + app/admin/verify).
//
// Token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
// Payload is { t: tutorId, iat: epochSeconds }. Signed with
// VERIFICATION_APPROVE_SECRET. Tokens older than MAX_AGE are rejected.
// ============================================================================

import crypto from "crypto";

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function secret() {
  const s = process.env.VERIFICATION_APPROVE_SECRET;
  if (!s) throw new Error("VERIFICATION_APPROVE_SECRET is not configured");
  return s;
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function sign(payloadB64) {
  return b64url(crypto.createHmac("sha256", secret()).update(payloadB64).digest());
}

/** Build a token approving `tutorId`. */
export function signApproveToken(tutorId) {
  const payload = b64url(JSON.stringify({ t: tutorId, iat: Math.floor(Date.now() / 1000) }));
  return `${payload}.${sign(payload)}`;
}

/**
 * Validate a token. Returns { tutorId } on success or { error } on failure
 * (bad shape, bad signature, or expired). Uses a constant-time compare.
 */
export function verifyApproveToken(token) {
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
  if (!payload?.t) return { error: "malformed" };
  if (!Number.isFinite(payload.iat) || Date.now() / 1000 - payload.iat > MAX_AGE_SECONDS) {
    return { error: "expired" };
  }
  return { tutorId: payload.t };
}
