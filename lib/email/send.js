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
const DEFAULT_FROM = "MatchTutor <onboarding@resend.dev>";

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

// Brand font stack. General Sans is Fontshare-hosted and no mail client will
// load it, so these deliberately use the system sans stack rather than a web
// font — the wordmark below is live text for the same reason (an image would
// need hosting and breaks with images-off).
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Split-colour "MatchTutor" wordmark as text.
const wordmark = (size = 22) => `
  <div style="font-family:${SANS};font-size:${size}px;font-weight:500;letter-spacing:-0.01em;margin-bottom:18px;">
    <span style="color:#014848;">Match</span><span style="color:#016764;">Tutor</span>
  </div>`;

const wrap = (inner) => `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background:#FFFFFF;">
      <div style="font-family:${SANS};max-width:520px;margin:0 auto;padding:24px 16px;color:#001E1E;">
        ${wordmark()}
        ${inner}
        <p style="font-size:13px;color:#6B8A88;margin-top:28px;">MatchTutor</p>
      </div>
    </body>
  </html>`;

const button = (href, label) => `
  <a href="${href}" style="display:inline-block;background:#016764;color:#fff;text-decoration:none;font-weight:500;font-size:14px;padding:11px 20px;border-radius:10px;">${label}</a>`;

/** Sent to a brand-new user once their account is confirmed (see lib/notifications.js → sendWelcomeIfNeeded). */
export function welcomeEmail({ name, ctaUrl }) {
  return wrap(`
    <h2 style="font-size:22px;font-weight:500;letter-spacing:-0.02em;color:#014848;margin:0 0 10px;">Welcome to MatchTutor 👋</h2>
    <p style="font-size:14px;line-height:1.55;color:#33514F;">
      Hi ${escapeHtml(name || "there")}, your account is all set. Browse tutors to find the
      right match for you or your child on MatchTutor.
    </p>
    ${ctaUrl ? `<div style="margin:22px 0;">${button(ctaUrl, "Browse tutors")}</div>` : ""}
  `);
}

/** Sent to a message recipient (student or tutor) when the other party messages them. */
export function messageEmail({ senderName, ctaUrl }) {
  return wrap(`
    <h2 style="font-size:22px;font-weight:500;letter-spacing:-0.02em;color:#014848;margin:0 0 10px;">New message</h2>
    <p style="font-size:14px;line-height:1.55;color:#33514F;">
      You have a new message from <span style="font-weight:500;">${escapeHtml(senderName || "someone")}</span> on MatchTutor.
    </p>
    ${ctaUrl ? `<div style="margin:22px 0;">${button(ctaUrl, "Open conversation")}</div>` : ""}
  `);
}

/** Sent to the admin (matchtutoraustralia@gmail.com) on a new request. */
export function adminRequestEmail({ tutorName, approveUrl, profileUrl }) {
  return wrap(`
    <h2 style="font-size:22px;font-weight:500;letter-spacing:-0.02em;color:#014848;margin:0 0 10px;">New verification request</h2>
    <p style="font-size:14px;line-height:1.55;color:#33514F;">
      <span style="font-weight:500;">${escapeHtml(tutorName || "A tutor")}</span> has requested to have their account verified.
      Review their profile, then approve if everything checks out.
    </p>
    ${profileUrl ? `<p style="font-size:14px;margin:14px 0;"><a href="${profileUrl}" style="color:#016764;">View their public profile →</a></p>` : ""}
    <div style="margin:22px 0;">${button(approveUrl, "Review")}</div>
    <p style="font-size:12px;color:#6B8A88;">The link opens a review page where you can approve or reject the request — nothing changes until you choose there.</p>
  `);
}

/** Sent to the tutor when their request is received. */
export function userRequestedEmail({ name }) {
  return wrap(`
    <h2 style="font-size:22px;font-weight:500;letter-spacing:-0.02em;color:#014848;margin:0 0 10px;">We've got your verification request</h2>
    <p style="font-size:14px;line-height:1.55;color:#33514F;">
      Hi ${escapeHtml(name || "there")}, thanks for requesting verification. Our team will review
      your profile shortly — we'll email you again as soon as it's approved.
    </p>
  `);
}

/** Sent to the tutor when an admin approves them. */
export function userApprovedEmail({ name, profileUrl }) {
  return wrap(`
    <h2 style="font-size:22px;font-weight:500;letter-spacing:-0.02em;color:#014848;margin:0 0 10px;">You're verified ✓</h2>
    <p style="font-size:14px;line-height:1.55;color:#33514F;">
      Congratulations ${escapeHtml(name || "")}! Your MatchTutor profile now shows the verified badge
      and ranks higher in search results.
    </p>
    ${profileUrl ? `<div style="margin:22px 0;">${button(profileUrl, "View your profile")}</div>` : ""}
  `);
}

/** Sent to the tutor when an admin rejects their verification request. */
export function userRejectedEmail({ name, profileUrl }) {
  return wrap(`
    <h2 style="font-size:22px;font-weight:500;letter-spacing:-0.02em;color:#014848;margin:0 0 10px;">Verification not approved</h2>
    <p style="font-size:14px;line-height:1.55;color:#33514F;">
      Hi ${escapeHtml(name || "there")}, an admin reviewed your profile and couldn't verify your
      account this time. This often just means a few details need filling in — update your profile
      and you're welcome to request another review whenever you're ready.
    </p>
    ${profileUrl ? `<div style="margin:22px 0;">${button(profileUrl, "Update your profile")}</div>` : ""}
  `);
}

/** Human labels for report categories (keep in sync with 0053 CHECK + ReportModal). */
const REPORT_CATEGORY_LABELS = {
  harassment: "Harassment or abuse",
  spam: "Spam",
  inappropriate: "Inappropriate content",
  scam: "Scam or fraud",
  other: "Other",
};

/** Sent to the admin when a user files a report. Links to the review page. */
export function adminReportEmail({ reporterName, reportedName, category, details, reviewUrl }) {
  const categoryLabel = REPORT_CATEGORY_LABELS[category] || "Other";
  return wrap(`
    <h2 style="font-size:22px;font-weight:500;letter-spacing:-0.02em;color:#014848;margin:0 0 10px;">New user report</h2>
    <p style="font-size:14px;line-height:1.55;color:#33514F;">
      <span style="font-weight:500;">${escapeHtml(reporterName || "A user")}</span> reported
      <span style="font-weight:500;">${escapeHtml(reportedName || "another user")}</span> on MatchTutor.
    </p>
    <div style="font-size:14px;background:#FFFFFF;border:1px solid #E4DCC8;border-radius:10px;padding:14px 16px;margin:14px 0;">
      <div><span style="font-weight:500;">Reason:</span> ${escapeHtml(categoryLabel)}</div>
      ${details ? `<div style="margin-top:8px;white-space:pre-wrap;">${escapeHtml(details)}</div>` : ""}
    </div>
    <div style="margin:22px 0;">${button(reviewUrl, "Review report")}</div>
    <p style="font-size:12px;color:#6B8A88;">The link opens a review page with the full conversation, where you can disable either account or dismiss the report. Nothing changes until you choose there.</p>
  `);
}

/** Sent to the reporter confirming their report was received. */
export function reportReceivedEmail({ name }) {
  return wrap(`
    <h2 style="font-size:22px;font-weight:500;letter-spacing:-0.02em;color:#014848;margin:0 0 10px;">We've received your report</h2>
    <p style="font-size:14px;line-height:1.55;color:#33514F;">
      Hi ${escapeHtml(name || "there")}, thanks for letting us know. We've blocked this person for you and
      our team will review the conversation. You won't hear from them again in the meantime.
    </p>
  `);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
