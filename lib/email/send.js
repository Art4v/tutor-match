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
 *
 * `replyTo` is optional: when set, the recipient's "Reply" goes there instead of
 * EMAIL_FROM. Used by the bug-report route so the team can reply straight to the
 * reporter.
 */
export async function sendEmail({ to, subject, html, replyTo }) {
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
      body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
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

// Teal palette, mirroring app/globals.css :root. Named here rather than inlined
// per template so a retint is one edit — the templates below must not hardcode
// colours (a stray warm-cream border survived an earlier sweep exactly that way).
const HEADING = "#014848"; // --ink-graphite
const ACCENT = "#016764"; // --accent
const BODY = "#33514F"; // --ink-muted
const MUTED = "#6B8A88"; // --sage
const LINE = "#E7EDEC"; // --paper-line
const PANEL = "#F7FBFB"; // --desk

// Split-colour "MatchTutor" wordmark as text.
const wordmark = (size = 22) => `
  <div style="font-family:${SANS};font-size:${size}px;font-weight:500;letter-spacing:-0.01em;margin-bottom:18px;">
    <span style="color:${HEADING};">Match</span><span style="color:${ACCENT};">Tutor</span>
  </div>`;

// The one heading style every template uses. No light weight exists in the
// system sans stack, so headings are 500 here rather than the site's 300.
const heading = (text) => `
  <h2 style="font-size:22px;font-weight:500;letter-spacing:-0.02em;color:${HEADING};margin:0 0 10px;">${text}</h2>`;

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
        <p style="font-size:13px;color:${MUTED};margin-top:28px;">MatchTutor</p>
      </div>
    </body>
  </html>`;

const button = (href, label) => `
  <a href="${href}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font-weight:500;font-size:14px;padding:11px 20px;border-radius:10px;">${label}</a>`;

/** Sent to a brand-new user once their account is confirmed (see lib/notifications.js → sendWelcomeIfNeeded). */
export function welcomeEmail({ name, ctaUrl }) {
  return wrap(`
    ${heading("Welcome to MatchTutor 👋")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      Hi ${escapeHtml(name || "there")}, your account is all set. Browse tutors to find the
      right match for you or your child on MatchTutor.
    </p>
    ${ctaUrl ? `<div style="margin:22px 0;">${button(ctaUrl, "Browse tutors")}</div>` : ""}
  `);
}

/** Sent to a message recipient (student or tutor) when the other party messages them. */
export function messageEmail({ senderName, ctaUrl }) {
  return wrap(`
    ${heading("New message")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      You have a new message from <span style="font-weight:500;">${escapeHtml(senderName || "someone")}</span> on MatchTutor.
    </p>
    ${ctaUrl ? `<div style="margin:22px 0;">${button(ctaUrl, "Open conversation")}</div>` : ""}
  `);
}

/** Sent to the admin (matchtutoraustralia@gmail.com) on a new request. */
export function adminRequestEmail({ tutorName, approveUrl, profileUrl }) {
  return wrap(`
    ${heading("New verification request")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      <span style="font-weight:500;">${escapeHtml(tutorName || "A tutor")}</span> has requested to have their account verified.
      Review their profile, then approve if everything checks out.
    </p>
    ${profileUrl ? `<p style="font-size:14px;margin:14px 0;"><a href="${profileUrl}" style="color:${ACCENT};">View their public profile →</a></p>` : ""}
    <div style="margin:22px 0;">${button(approveUrl, "Review")}</div>
    <p style="font-size:12px;color:${MUTED};">The link opens a review page where you can approve or reject the request. Nothing changes until you choose there.</p>
  `);
}

/** Sent to the tutor when their request is received. */
export function userRequestedEmail({ name }) {
  return wrap(`
    ${heading("We've got your verification request")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      Hi ${escapeHtml(name || "there")}, thanks for requesting verification. Our team will review
      your profile shortly, and we'll email you again as soon as it's approved.
    </p>
  `);
}

/** Sent to the tutor when an admin approves them. */
export function userApprovedEmail({ name, profileUrl }) {
  return wrap(`
    ${heading("You're verified ✓")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      Congratulations ${escapeHtml(name || "")}! Your MatchTutor profile now shows the verified badge
      and ranks higher in search results.
    </p>
    ${profileUrl ? `<div style="margin:22px 0;">${button(profileUrl, "View your profile")}</div>` : ""}
  `);
}

/** Sent to the tutor when an admin rejects their verification request. */
export function userRejectedEmail({ name, profileUrl }) {
  return wrap(`
    ${heading("Verification not approved")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      Hi ${escapeHtml(name || "there")}, an admin reviewed your profile and couldn't verify your
      account this time. This often just means a few details need filling in. Update your profile
      and you're welcome to request another review whenever you're ready.
    </p>
    ${profileUrl ? `<div style="margin:22px 0;">${button(profileUrl, "Update your profile")}</div>` : ""}
  `);
}

/** Human labels for report categories (keep in sync with 0059 CHECK + ReportModal). */
const REPORT_CATEGORY_LABELS = {
  harassment: "Harassment or abuse",
  spam: "Spam",
  inappropriate: "Inappropriate content",
  scam: "Scam or fraud",
  other: "Other",
  inappropriate_review: "Inappropriate review",
};

/** Sent to the admin when a user files a report. Links to the review page. */
export function adminReportEmail({ reporterName, reportedName, category, details, reviewUrl, kind = "conversation" }) {
  const categoryLabel = REPORT_CATEGORY_LABELS[category] || "Other";
  const aboutAReview = kind === "review";
  return wrap(`
    ${heading(aboutAReview ? "A review was reported" : "New user report")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      <span style="font-weight:500;">${escapeHtml(reporterName || "A user")}</span> reported
      ${aboutAReview
        ? `a review written by <span style="font-weight:500;">${escapeHtml(reportedName || "another user")}</span>`
        : `<span style="font-weight:500;">${escapeHtml(reportedName || "another user")}</span>`} on MatchTutor.
    </p>
    <div style="font-size:14px;background:${PANEL};border:1px solid ${LINE};border-radius:10px;padding:14px 16px;margin:14px 0;">
      <div><span style="font-weight:500;">Reason:</span> ${escapeHtml(categoryLabel)}</div>
      ${details ? `<div style="margin-top:8px;white-space:pre-wrap;">${escapeHtml(details)}</div>` : ""}
    </div>
    <div style="margin:22px 0;">${button(reviewUrl, "Review report")}</div>
    <p style="font-size:12px;color:${MUTED};">${aboutAReview
      ? "The link opens a page showing the review, where you can remove it, disable the account that wrote it, or dismiss the report."
      : "The link opens a review page with the full conversation, where you can disable either account or dismiss the report."} Nothing changes until you choose there.</p>
  `);
}

/**
 * Sent to the reporter confirming their report was received. The copy branches
 * on kind because only a conversation report blocks anyone — a review report
 * deliberately does not, so promising a block here would be false.
 */
export function reportReceivedEmail({ name, kind = "conversation" }) {
  const aboutAReview = kind === "review";
  return wrap(`
    ${heading("We've received your report")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      Hi ${escapeHtml(name || "there")}, thanks for letting us know. ${aboutAReview
        ? "Our team will take a look at that review and decide whether it should stay up."
        : "We've blocked this person for you and our team will review the conversation. You won't hear from them again in the meantime."}
    </p>
  `);
}

// ---------------------------------------------------------------------------
// Reviews (0057). A student's review is invisible until an admin approves it
// from the link in adminReviewEmail below.
// ---------------------------------------------------------------------------

/** Rating as text. No mail client will load the site's icon set, so glyphs it is. */
const stars = (n) => {
  const filled = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
};

/** Sent to the admin on every new or edited review. Links to the moderation page. */
export function adminReviewEmail({ studentName, tutorName, rating, body, reviewUrl }) {
  return wrap(`
    ${heading("New review to approve")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      <span style="font-weight:500;">${escapeHtml(studentName || "A student")}</span> reviewed
      <span style="font-weight:500;">${escapeHtml(tutorName || "a tutor")}</span> on MatchTutor.
      It stays hidden until you approve it.
    </p>
    <div style="font-size:14px;background:${PANEL};border:1px solid ${LINE};border-radius:10px;padding:14px 16px;margin:14px 0;">
      <div><span style="font-weight:500;">Rating:</span> <span style="color:${ACCENT};letter-spacing:2px;">${stars(rating)}</span> ${escapeHtml(String(rating ?? ""))}/5</div>
      ${body ? `<div style="margin-top:8px;white-space:pre-wrap;">${escapeHtml(body)}</div>` : `<div style="margin-top:8px;color:${MUTED};">No written review.</div>`}
    </div>
    <div style="margin:22px 0;">${button(reviewUrl, "Review")}</div>
    <p style="font-size:12px;color:${MUTED};">The link opens a page where you can approve or reject it. Nothing changes until you choose there.</p>
  `);
}

/** Sent to the student the moment they leave a review. */
export function reviewReceivedEmail({ name, tutorName }) {
  return wrap(`
    ${heading("Thanks for leaving a review")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      Hi ${escapeHtml(name || "there")}, thanks for reviewing
      <span style="font-weight:500;">${escapeHtml(tutorName || "your tutor")}</span>.
      Every review is checked by our team before it goes live, so it may take a little while to
      appear on their profile. We'll email you once it does.
    </p>
  `);
}

/** Sent to the student when an admin approves their review. */
export function reviewApprovedEmail({ name, tutorName, profileUrl }) {
  return wrap(`
    ${heading("Your review is now live")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      Hi ${escapeHtml(name || "there")}, your review of
      <span style="font-weight:500;">${escapeHtml(tutorName || "your tutor")}</span> has been approved
      and now appears on their profile. Thanks for helping other students choose.
    </p>
    ${profileUrl ? `<div style="margin:22px 0;">${button(profileUrl, "View the profile")}</div>` : ""}
  `);
}

/** Sent to the student when an admin rejects their review. They can edit and resubmit. */
export function reviewRejectedEmail({ name, tutorName, profileUrl }) {
  return wrap(`
    ${heading("Your review wasn't published")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      Hi ${escapeHtml(name || "there")}, our team read your review of
      <span style="font-weight:500;">${escapeHtml(tutorName || "your tutor")}</span> and couldn't publish
      it this time. This usually means something in it fell outside our guidelines. You're welcome to
      edit it, which sends it back to us for another look.
    </p>
    ${profileUrl ? `<div style="margin:22px 0;">${button(profileUrl, "Edit your review")}</div>` : ""}
  `);
}

/** Sent to the tutor when a review of them is published. */
export function newReviewEmail({ name, rating, profileUrl }) {
  return wrap(`
    ${heading("You have a new review")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      Hi ${escapeHtml(name || "there")}, a student left you a
      <span style="color:${ACCENT};letter-spacing:2px;">${stars(rating)}</span> review on MatchTutor,
      and it's now showing on your profile.
    </p>
    ${profileUrl ? `<div style="margin:22px 0;">${button(profileUrl, "View your profile")}</div>` : ""}
  `);
}

/** Sent to the team inbox (matchtutoraustralia@gmail.com) when someone files a bug report. */
export function bugReportEmail({ name, email, message }) {
  return wrap(`
    ${heading("New bug report")}
    <p style="font-size:14px;line-height:1.55;color:${BODY};">
      <span style="font-weight:500;">${escapeHtml(name || "Someone")}</span> submitted a bug report through the site.
    </p>
    <div style="font-size:14px;background:${PANEL};border:1px solid ${LINE};border-radius:10px;padding:14px 16px;margin:14px 0;">
      <div><span style="font-weight:500;">From:</span> ${escapeHtml(name || "(no name)")}</div>
      <div style="margin-top:4px;"><span style="font-weight:500;">Email:</span> <a href="mailto:${escapeHtml(email)}" style="color:${ACCENT};">${escapeHtml(email)}</a></div>
      <div style="margin-top:8px;white-space:pre-wrap;">${escapeHtml(message)}</div>
    </div>
    <p style="font-size:12px;color:${MUTED};">Reply to this email to respond to ${escapeHtml(name || "the reporter")} directly.</p>
  `);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
