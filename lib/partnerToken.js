// ============================================================================
// Signed partner-invite tokens (SERVER-ONLY).
// ----------------------------------------------------------------------------
// Partners are invite only. We create the partners row, then send the centre a
// link carrying an HMAC-signed token instead of a session — possession of a
// valid token is the authorization to bind that partner to your account (see
// app/partners/claim + app/api/partners/claim).
//
// Token = base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload)).
// Payload is { p: partnerId, iat: epochSeconds }. Signed with
// PARTNER_INVITE_SECRET. Tokens older than MAX_AGE are rejected.
//
// There is no single-use flag and no invites table on purpose: claim_partner()
// only writes `where owner_id is null`, so a link is inert the moment it has
// been used once. Expiry here is belt-and-braces, not the actual defence.
// ============================================================================

import crypto from "crypto";

const MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 days — a sales cycle, not a session

function secret() {
  const s = process.env.PARTNER_INVITE_SECRET;
  if (!s) throw new Error("PARTNER_INVITE_SECRET is not configured");
  return s;
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function sign(payloadB64) {
  return b64url(crypto.createHmac("sha256", secret()).update(payloadB64).digest());
}

/** Build a token inviting someone to claim `partnerId`. */
export function signPartnerInviteToken(partnerId) {
  const payload = b64url(JSON.stringify({ p: partnerId, iat: Math.floor(Date.now() / 1000) }));
  return `${payload}.${sign(payload)}`;
}

/**
 * Validate a token. Returns { partnerId } on success or { error } on failure
 * (bad shape, bad signature, or expired). Uses a constant-time compare.
 */
export function verifyPartnerInviteToken(token) {
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
  if (!payload?.p) return { error: "malformed" };
  if (!Number.isFinite(payload.iat) || Date.now() / 1000 - payload.iat > MAX_AGE_SECONDS) {
    return { error: "expired" };
  }
  return { partnerId: payload.p };
}
