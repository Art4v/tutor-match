// ============================================================================
// emailAdmins: the alert email for every admin decision queue (SERVER-ONLY).
// ----------------------------------------------------------------------------
// Admin decisions happen in /admin (0074); email only says "something is
// waiting" and links there. Recipients are every enabled admin who has not
// muted alerts on /admin. If nobody qualifies (no admins granted yet in this
// environment, or everyone muted) it falls back to ADMIN_EMAIL, so an alert
// never disappears silently.
//
// Never throws, like sendEmail: the state that triggered the alert is already
// committed.
// ============================================================================

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";

export const ADMIN_FALLBACK_EMAIL = process.env.ADMIN_EMAIL || "matchtutoraustralia@gmail.com";

export async function emailAdmins({ subject, html }) {
  const recipients = await adminRecipients();
  const to = recipients.length ? recipients : [ADMIN_FALLBACK_EMAIL];
  const results = await Promise.all(to.map((address) => sendEmail({ to: address, subject, html })));
  return { ok: results.every((r) => r.ok), sent: to.length };
}

async function adminRecipients() {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  try {
    const { data: rows, error } = await admin
      .from("profiles")
      .select("id")
      .eq("is_admin", true)
      .eq("status", "enabled")
      .eq("admin_alerts_muted", false);
    if (error) {
      console.error("[admin alerts] could not list admins:", error);
      return [];
    }
    const emails = await Promise.all(
      (rows ?? []).map(async ({ id }) => {
        const { data } = await admin.auth.admin.getUserById(id);
        return data?.user?.email || null;
      })
    );
    return [...new Set(emails.filter(Boolean))];
  } catch (err) {
    console.error("[admin alerts] recipient lookup threw:", err);
    return [];
  }
}
