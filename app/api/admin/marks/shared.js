// SERVER-ONLY. What the two /api/admin/marks routes do after their RPC applied:
// the storage clean-up and the tutor's notification + email (0083). Both
// routes change the same fact, so the tutor hears about it the same way.

import { notifyUser } from "@/lib/notifications";
import { userMarksGrantedEmail, userMarksDeclinedEmail, userMarksRevokedEmail } from "@/lib/email/send";
import { countSavedVerificationDocs, purgeVerificationDocs } from "@/lib/admin/verificationDocs";

/**
 * outcome: "granted" | "declined" | "revoked". `result` is the RPC's return
 * ({ name, slug, reason }). Returns { purgeFailed }.
 */
export async function afterMarksDecision(admin, { tutorId, outcome, result, origin }) {
  const name = result?.name || "";
  const reason = result?.reason || null;
  const publicUrl = result?.slug ? `${origin}/tutor/${result.slug}` : null;
  const ownUrl = `${origin}/profile`;
  const note = reason ? ` Reviewer's note: "${reason}".` : "";
  let purgeFailed = false;

  if (outcome === "granted") {
    // Reaching the seal flagged the tutor's private files (0083). If this
    // fails the grant stands, and the admin page offers a Retry.
    purgeFailed = !(await purgeVerificationDocs(admin, tutorId)).ok;
    await notifyUser(admin, tutorId, {
      type: "marks_granted",
      title: "Your marks are verified ✓",
      body: `Your profile now shows the marks verified seal and ranks at the top of search.${note}`,
      email: {
        subject: "Your marks are verified on MatchTutor ✓",
        html: userMarksGrantedEmail({ name, reason, profileUrl: publicUrl }),
      },
    });
  } else if (outcome === "declined") {
    const hasDocuments = (await countSavedVerificationDocs(admin, tutorId)) > 0;
    const main = reason
      ? `Reviewer's note: "${reason}". You are still verified, and you can ask again at any time.`
      : "An admin couldn't confirm your marks this time. You are still verified, and you can ask again at any time.";
    await notifyUser(admin, tutorId, {
      type: "marks_declined",
      title: "Marks verification not approved",
      body: hasDocuments ? `${main} Your supporting documents are saved for your next request.` : main,
      email: {
        subject: "Your MatchTutor marks verification wasn't approved",
        html: userMarksDeclinedEmail({ name, reason, profileUrl: ownUrl, hasDocuments }),
      },
    });
  } else {
    await notifyUser(admin, tutorId, {
      type: "marks_revoked",
      title: "Marks verified seal removed",
      body: `An admin removed the marks verified seal from your profile. You are still verified and listed.${note}`,
      email: {
        subject: "Your MatchTutor marks verified seal was removed",
        html: userMarksRevokedEmail({ name, reason, profileUrl: ownUrl }),
      },
    });
  }

  return { purgeFailed };
}
