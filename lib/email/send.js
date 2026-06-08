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

const wrap = (inner) => `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:8px 4px;color:#0F172A;">
    <div style="font-size:18px;font-weight:600;letter-spacing:-0.02em;margin-bottom:18px;">
      match<span style="color:#4F46E5;">tutor</span>
    </div>
    ${inner}
    <p style="font-size:12px;color:#94A3B8;margin-top:28px;">matchtutor · tutor verification</p>
  </div>`;

const button = (href, label) => `
  <a href="${href}" style="display:inline-block;background:#4F46E5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;">${label}</a>`;

/** Sent to the admin (matchtutoraustralia@gmail.com) on a new request. */
export function adminRequestEmail({ tutorName, approveUrl, profileUrl }) {
  return wrap(`
    <h2 style="font-size:18px;margin:0 0 10px;">New verification request</h2>
    <p style="font-size:14px;line-height:1.55;color:#334155;">
      <strong>${escapeHtml(tutorName || "A tutor")}</strong> has requested to have their account verified.
      Review their profile, then approve if everything checks out.
    </p>
    ${profileUrl ? `<p style="font-size:14px;margin:14px 0;"><a href="${profileUrl}" style="color:#4F46E5;">View their public profile →</a></p>` : ""}
    <div style="margin:22px 0;">${button(approveUrl, "Review & approve")}</div>
    <p style="font-size:12px;color:#94A3B8;">Approving flips on their verified badge and boosts their ranking. The link opens a confirmation page first — nothing changes until you click Approve there.</p>
  `);
}

/** Sent to the tutor when their request is received. */
export function userRequestedEmail({ name }) {
  return wrap(`
    <h2 style="font-size:18px;margin:0 0 10px;">We've got your verification request</h2>
    <p style="font-size:14px;line-height:1.55;color:#334155;">
      Hi ${escapeHtml(name || "there")}, thanks for requesting verification. Our team will review
      your profile shortly — we'll email you again as soon as it's approved.
    </p>
  `);
}

/** Sent to the tutor when an admin approves them. */
export function userApprovedEmail({ name, profileUrl }) {
  return wrap(`
    <h2 style="font-size:18px;margin:0 0 10px;">You're verified ✓</h2>
    <p style="font-size:14px;line-height:1.55;color:#334155;">
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
