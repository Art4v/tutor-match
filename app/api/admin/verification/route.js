import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { userApprovedEmail, userApprovedWithMarksEmail, userRejectedEmail } from "@/lib/email/send";
import { countSavedVerificationDocs, purgeVerificationDocs } from "@/lib/admin/verificationDocs";
import {
  requireAdminRequest,
  readJson,
  cleanReason,
  adminRpcErrorResponse,
  lastAdminAction,
  originOf,
  revalidateIndexable,
} from "@/lib/admin/route";

export const runtime = "nodejs";

// Approve or reject a tutor's verification request from /admin/verification.
// POST { tutorId, decision: "approve" | "approve_marks" | "reject", reason? }.
// The decision is admin_decide_verification (0074, 0083), which re-checks the
// caller is an admin, only acts while the request is still pending, and writes
// History. "approve_marks" also grants the marks verified seal.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  const decision = body?.decision;
  if (!body?.tutorId || !["approve", "approve_marks", "reject"].includes(decision)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const reason = cleanReason(body.reason);

  const { data: result, error } = await supabase.rpc("admin_decide_verification", {
    p_tutor_id: body.tutorId,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) return adminRpcErrorResponse(error, "Could not save the decision, please try again.");

  if (!result?.applied) {
    const decided = await lastAdminAction(supabase, "tutor", body.tutorId, "verification_");
    return NextResponse.json({ ok: true, alreadyDecided: true, status: result?.status ?? null, decided });
  }

  const admin = createSupabaseAdminClient();
  const origin = originOf(request);
  const name = result.name || "";
  let purgeFailed = false;

  if (decision !== "reject") {
    const withMarks = result.marks === true;
    // The approval flagged the tutor's private files (0079). If this fails the
    // approval stands, and the admin page offers a Retry.
    purgeFailed = !(await purgeVerificationDocs(admin, body.tutorId)).ok;
    // A verified tutor joins listIndexableTutors (sitemap, llms, /tutors).
    revalidateIndexable(revalidatePath);
    const profileUrl = result.slug ? `${origin}/tutor/${result.slug}` : null;
    await notifyUser(admin, body.tutorId, {
      type: "verification_approved",
      title: withMarks ? "You're verified, marks included ✓" : "You're verified ✓",
      body: withMarks
        ? "Your profile now shows the verified badge and the marks verified seal, and ranks at the top of search."
        : "Your profile now shows the verified badge and ranks higher in search.",
      email: {
        subject: "You're verified on MatchTutor ✓",
        html: withMarks ? userApprovedWithMarksEmail({ name, profileUrl }) : userApprovedEmail({ name, profileUrl }),
      },
    });
  } else {
    const hasDocuments = (await countSavedVerificationDocs(admin, body.tutorId)) > 0;
    const main = reason
      ? `Reviewer's note: "${reason}". Update your profile and you can request another review.`
      : "An admin reviewed your profile and couldn't verify it this time. Update your profile and you can request another review.";
    await notifyUser(admin, body.tutorId, {
      type: "verification_rejected",
      title: "Verification not approved",
      body: hasDocuments ? `${main} Your supporting documents are saved for your next request.` : main,
      email: {
        subject: "Your MatchTutor verification wasn't approved",
        html: userRejectedEmail({ name, reason, profileUrl: `${origin}/profile`, hasDocuments }),
      },
    });
  }

  return NextResponse.json({ ok: true, status: result.status, purgeFailed });
}
