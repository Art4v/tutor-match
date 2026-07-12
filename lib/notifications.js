// ============================================================================
// notifyUser — the single path for sending a user a notification (SERVER-ONLY).
// ----------------------------------------------------------------------------
// Inserts a `notifications` row AND emails the user. Centralised so the rule
// "every notification is also emailed" holds for both verification events.
//
// Takes the service-role admin client (lib/supabase/admin.js) because:
//   * the notifications table has no INSERT RLS policy (rows are server-written)
//   * the user's email is read via auth.admin.getUserById
//
// Never throws — the DB state that triggered the notification is already
// committed, so a notify failure is logged, not propagated.
// ============================================================================

import { sendEmail, welcomeEmail } from "@/lib/email/send";

/**
 * @param admin  service-role Supabase client (createSupabaseAdminClient())
 * @param userId auth.users.id of the recipient
 * @param opts   { type, title, body, email: { subject, html } }
 * Returns { ok, error? }.
 */
export async function notifyUser(admin, userId, { type, title, body, email }) {
  if (!admin) {
    console.warn("[notify] no admin client (SUPABASE_SERVICE_ROLE_KEY unset) — skipping notification");
    return { ok: false, error: "no-admin-client" };
  }

  // 1. Persist the in-app notification.
  const { error: insertErr } = await admin
    .from("notifications")
    .insert({ user_id: userId, type, title, body: body ?? null });
  if (insertErr) {
    console.error("[notify] failed to insert notification:", insertErr);
    // Fall through — still try to email, the two aren't transactional.
  }

  // 2. Email the user (resolve their address via the admin API).
  if (email) {
    try {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      const to = data?.user?.email;
      if (error || !to) {
        console.error("[notify] could not resolve user email:", error);
      } else {
        await sendEmail({ to, subject: email.subject, html: email.html });
      }
    } catch (err) {
      console.error("[notify] email step threw:", err);
    }
  }

  return { ok: !insertErr };
}

// ============================================================================
// sendWelcomeIfNeeded — one-time welcome notification + email for a new user.
// ----------------------------------------------------------------------------
// Called from /auth/callback once an account is confirmed (email signup) or on
// first OAuth sign-in. Idempotent WITHOUT a schema change: the welcome is sent
// only when no prior `type='welcome'` notification exists for the user, so the
// row itself is the "already welcomed" marker — re-clicking a confirm link or
// signing in with Google again never re-sends. Never throws.
// ============================================================================

/**
 * @param admin  service-role Supabase client (createSupabaseAdminClient())
 * @param userId auth.users.id of the new user
 * @param opts   { name, origin } — display name (for the greeting) + request origin (for the CTA link)
 */
export async function sendWelcomeIfNeeded(admin, userId, { name, origin } = {}) {
  if (!admin) {
    console.warn("[welcome] no admin client (SUPABASE_SERVICE_ROLE_KEY unset) — skipping welcome");
    return { ok: false, error: "no-admin-client" };
  }

  try {
    // Guard: bail if this user has already been welcomed.
    const { data: existing, error: selErr } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "welcome")
      .limit(1)
      .maybeSingle();
    if (selErr) {
      console.error("[welcome] could not check for existing welcome:", selErr);
      return { ok: false, error: "check-failed" };
    }
    if (existing) return { ok: true, skipped: true };
  } catch (err) {
    console.error("[welcome] welcome check threw:", err);
    return { ok: false, error: String(err) };
  }

  return notifyUser(admin, userId, {
    type: "welcome",
    title: "Welcome to matchtutor 👋",
    body: "Your account is ready. Browse tutors to find the right match.",
    email: {
      subject: "Welcome to matchtutor",
      html: welcomeEmail({ name, ctaUrl: origin ? `${origin}/browse` : undefined }),
    },
  });
}
