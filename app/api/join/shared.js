// Shared by the /api/join routes and /auth/callback (not itself a route: only
// route.js files are). Redeeming the invite key and alerting the admins happen
// in exactly one place, whichever way the tutor arrived (email signup, Google,
// or an existing account opting in).

import { emailAdmins } from "@/lib/admin/alerts";
import { adminInvitedTutorEmail } from "@/lib/email/send";
import { adminPaths } from "@/lib/admin/urls";
import { isInviteKey } from "@/lib/tutorInvite";

/** Client IP for the soft rate limits (first hop of x-forwarded-for). */
export function clientIp(request) {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

/** Is the key current? Service-role check, so a dead link creates nothing. */
export async function inviteKeyValid(admin, key) {
  if (!admin || !isInviteKey(key)) return false;
  const { data, error } = await admin.rpc("tutor_invite_key_valid", { p_key: key });
  return !error && data === true;
}

/**
 * Bind `userId` to the invite (redeem_tutor_invite, service role) and, on a
 * new binding, alert the admins. Returns { ok, created, already, hint }:
 * `hint` is the RPC's error hint (invalid_key, wrong_role, disabled,
 * admin_account) on failure.
 *
 * `origin` goes into the link the admins are emailed, so it must come from the
 * request URL (originOf), never from a client-supplied header.
 */
export async function redeemInvite(admin, { userId, key, origin }) {
  if (!admin) return { ok: false, hint: "not_configured" };
  if (!isInviteKey(key)) return { ok: false, hint: "invalid_key" };

  const { data, error } = await admin.rpc("redeem_tutor_invite", { p_user_id: userId, p_key: key });
  if (error) {
    if (!error.hint) console.error("[join] redeem failed:", error);
    return { ok: false, hint: error.hint || "failed", message: error.message };
  }

  if (!data?.already) {
    await emailAdmins({
      subject: data?.created ? "New tutor joined through the invite link" : "A tutor asked us to manage their profile",
      html: adminInvitedTutorEmail({
        tutorName: data?.name,
        reviewUrl: `${origin}${adminPaths.managedTutor(userId)}`,
        existing: !data?.created,
      }),
    });
  }
  return { ok: true, created: !!data?.created, already: !!data?.already };
}

/** User-facing copy for a redeem failure hint. */
export function redeemErrorMessage(hint) {
  switch (hint) {
    case "invalid_key":
      return "This invite link is no longer valid. Ask MatchTutor for a new one.";
    case "wrong_role":
      return "Only tutor accounts can use this link. Please sign up with a separate account.";
    case "disabled":
      return "This account is disabled.";
    case "admin_account":
      return "Admin accounts can't be managed through this link. Use a separate tutor account.";
    default:
      return "Something went wrong. Please try again.";
  }
}
