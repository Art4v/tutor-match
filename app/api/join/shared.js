// Shared by the /api/join routes and /auth/callback (not itself a route: only
// route.js files are). Rate limiting, redeeming and alerting the admins happen
// in exactly one place, whichever way the tutor arrived (email signup, Google,
// or an existing account opting in).

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { emailAdmins } from "@/lib/admin/alerts";
import { adminInvitedTutorEmail } from "@/lib/email/send";
import { adminPaths } from "@/lib/admin/urls";
import { revalidateIndexable } from "@/lib/admin/route";

/** Client IP for the rate limit (first hop of x-forwarded-for). */
export function clientIp(request) {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

export const TOO_MANY_ATTEMPTS = "Too many attempts. Please try again later.";

/**
 * The durable Quick join limit (0077): 5 attempts per IP per hour, counted in
 * Supabase so it holds across serverless instances. Only a hash of the IP
 * leaves this function. Returns true when the attempt may go ahead; a database
 * error fails CLOSED, since this is the only gate on who becomes managed.
 */
export async function consumeQuickJoinAttempt(admin, request) {
  if (!admin) return false;
  const ipHash = createHash("sha256").update(clientIp(request)).digest("hex");
  const { data, error } = await admin.rpc("consume_quick_join_attempt", { p_ip_hash: ipHash });
  if (error) {
    console.error("[join] rate limit check failed:", error);
    return false;
  }
  return data === true;
}

/**
 * Make `userId` admin-managed (redeem_tutor_invite, service role) and, on a
 * new binding, alert the admins. Returns { ok, created, already, hint }:
 * `hint` is the RPC's error hint (wrong_role, disabled, admin_account) on
 * failure.
 *
 * `origin` goes into the link the admins are emailed, so it must come from the
 * request URL (originOf), never from a client-supplied header.
 */
export async function redeemInvite(admin, { userId, origin }) {
  if (!admin) return { ok: false, hint: "not_configured" };

  const { data, error } = await admin.rpc("redeem_tutor_invite", { p_user_id: userId });
  if (error) {
    if (!error.hint) console.error("[join] redeem failed:", error);
    return { ok: false, hint: error.hint || "failed", message: error.message };
  }

  if (!data?.already) {
    // An existing tutor who opts in has just been hidden (0077), so the
    // cached machine-facing pages must stop listing them.
    if (!data?.created) revalidateIndexable(revalidatePath);
    await emailAdmins({
      subject: data?.created ? "New tutor joined through Quick join" : "A tutor asked us to manage their profile",
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
    case "wrong_role":
      return "Only tutor accounts can be managed. Please sign up with a separate account.";
    case "disabled":
      return "This account is disabled.";
    case "admin_account":
      return "Admin accounts can't be managed. Use a separate tutor account.";
    default:
      return "Something went wrong. Please try again.";
  }
}
