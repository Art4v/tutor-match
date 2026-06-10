// ============================================================================
// Transactional email sender (SERVER-ONLY) — Resend HTTP API.
// ----------------------------------------------------------------------------
// The app's auth emails are sent by Supabase over Resend SMTP (configured in the
// dashboard). This is the ONE place the app itself sends mail — the verification
// admin notice + the tutor's notification emails. It calls Resend's HTTP API
// directly (no SDK) with RESEND_API_KEY.
//
// If RESEND_API_KEY is unset (local dev), sendEmail() is a no-op that logs the
// message to the server console, so the verification flow can be exercised end
// to end without configuring mail. EMAIL_FROM must be a verified Resend domain
// address or Resend only delivers to your own account email.
// ============================================================================

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "matchtutor <onboarding@resend.dev>";

/**
 * Send one email. Returns { ok, skipped?, error? }. Never throws — a mail
 * failure must not break the request that triggered it (the DB state is already
 * committed by the time we email).
 */
export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY unset — would send to ${to}: "${subject}"`);
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend failed (${res.status}) sending to ${to}: ${detail}`);
      return { ok: false, error: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error(`[email] Resend threw sending to ${to}:`, err);
    return { ok: false, error: String(err) };
  }
}

// ── Templates ────────────────────────────────────────────────────────────────
// Minimal inline-styled HTML so they render in any client without a stylesheet.

// Handwritten brand font (Caveat, as on the site), used on the wordmark +
// headings. Web fonts render only in clients that allow them (Apple Mail, iOS
// Mail); the stack falls back to a system handwriting face then cursive.
const HAND = "'Caveat','Segoe Script','Bradley Hand',cursive";

const wrap = (inner) => `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap" rel="stylesheet" />
      <style>@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap');</style>
    </head>
    <body style="margin:0;padding:0;background:#F5F0E4;">
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#2A3A2E;">
        <img src="https://matchtutor.com.au/images/email/wordmark.png" alt="matchtutor" width="165" height="34" style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;width:165px;height:34px;margin-bottom:18px;" />
        ${inner}
        <p style="font-family:${HAND};font-size:15px;color:#8DA17E;margin-top:28px;">matchtutor</p>
      </div>
    </body>
  </html>`;

const button = (href, label) => `
  <a href="${href}" style="display:inline-block;background:#5E7A5A;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;">${label}</a>`;

/** Sent to a brand-new user once their account is confirmed (see lib/notifications.js → sendWelcomeIfNeeded). */
export function welcomeEmail({ name, profileUrl }) {
  return wrap(`
    <h2 style="font-family:${HAND};font-size:24px;font-weight:700;margin:0 0 10px;">Welcome to matchtutor 👋</h2>
    <p style="font-size:14px;line-height:1.55;color:#3D5440;">
      Hi ${escapeHtml(name || "there")}, your account is all set. Complete your profile to get
      started on matchtutor.
    </p>
    ${profileUrl ? `<div style="margin:22px 0;">${button(profileUrl, "Complete your profile")}</div>` : ""}
  `);
}

/** Sent to the admin (matchtutoraustralia@gmail.com) on a new request. */
export function adminRequestEmail({ tutorName, approveUrl, profileUrl }) {
  return wrap(`
    <h2 style="font-family:${HAND};font-size:24px;font-weight:700;margin:0 0 10px;">New verification request</h2>
    <p style="font-size:14px;line-height:1.55;color:#3D5440;">
      <strong>${escapeHtml(tutorName || "A tutor")}</strong> has requested to have their account verified.
      Review their profile, then approve if everything checks out.
    </p>
    ${profileUrl ? `<p style="font-size:14px;margin:14px 0;"><a href="${profileUrl}" style="color:#5E7A5A;">View their public profile →</a></p>` : ""}
    <div style="margin:22px 0;">${button(approveUrl, "Review & approve")}</div>
    <p style="font-size:12px;color:#8DA17E;">Approving flips on their verified badge and boosts their ranking. The link opens a confirmation page first — nothing changes until you click Approve there.</p>
  `);
}

/** Sent to the tutor when their request is received. */
export function userRequestedEmail({ name }) {
  return wrap(`
    <h2 style="font-family:${HAND};font-size:24px;font-weight:700;margin:0 0 10px;">We've got your verification request</h2>
    <p style="font-size:14px;line-height:1.55;color:#3D5440;">
      Hi ${escapeHtml(name || "there")}, thanks for requesting verification. Our team will review
      your profile shortly — we'll email you again as soon as it's approved.
    </p>
  `);
}

/** Sent to the tutor when an admin approves them. */
export function userApprovedEmail({ name, profileUrl }) {
  return wrap(`
    <h2 style="font-family:${HAND};font-size:24px;font-weight:700;margin:0 0 10px;">You're verified ✓</h2>
    <p style="font-size:14px;line-height:1.55;color:#3D5440;">
      Congratulations ${escapeHtml(name || "")}! Your matchtutor profile now shows the verified badge
      and ranks higher in search results.
    </p>
    ${profileUrl ? `<div style="margin:22px 0;">${button(profileUrl, "View your profile")}</div>` : ""}
  `);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
