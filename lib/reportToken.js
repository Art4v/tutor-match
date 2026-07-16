// ============================================================================
// Signed report-review tokens (SERVER-ONLY).
// ----------------------------------------------------------------------------
// The admin reviews a report by clicking a link in their email. That link
// carries an HMAC-signed token instead of a session — possession of a valid
// token is the authorization (see app/api/reports/resolve + app/admin/report).
// Mirrors lib/verifyToken.js, keyed by report id with its own secret so the two
// link classes are independent.
//
// Token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
// Payload is { r: reportId, iat: epochSeconds }. Signed with
// REPORT_REVIEW_SECRET. Tokens older than MAX_AGE are rejected.
// ============================================================================

import crypto from "crypto";

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function secret() {
  const s = process.env.REPORT_REVIEW_SECRET;
  if (!s) throw new Error("REPORT_REVIEW_SECRET is not configured");
  return s;
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function sign(payloadB64) {
  return b64url(crypto.createHmac("sha256", secret()).update(payloadB64).digest());
}

/** Build a token authorizing review of `reportId`. */
export function signReportToken(reportId) {
  const payload = b64url(JSON.stringify({ r: reportId, iat: Math.floor(Date.now() / 1000) }));
  return `${payload}.${sign(payload)}`;
}

/**
 * Validate a token. Returns { reportId } on success or { error } on failure
 * (bad shape, bad signature, or expired). Uses a constant-time compare.
 */
export function verifyReportToken(token) {
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
  return { reportId: payload.r };
}
