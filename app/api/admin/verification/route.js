import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { userApprovedEmail, userRejectedEmail } from "@/lib/email/send";
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
// POST { tutorId, decision: "approve" | "reject", reason? }. The decision is
// admin_decide_verification (0074), which re-checks the caller is an admin,
// only acts while the request is still pending, and writes History.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  const decision = body?.decision;
  if (!body?.tutorId || !["approve", "reject"].includes(decision)) {
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

  if (decision === "approve") {
    // A verified tutor joins listIndexableTutors (sitemap, llms, /tutors).
    revalidateIndexable(revalidatePath);
    const profileUrl = result.slug ? `${origin}/tutor/${result.slug}` : null;
    await notifyUser(admin, body.tutorId, {
      type: "verification_approved",
      title: "You're verified ✓",
      body: "Your profile now shows the verified badge and ranks higher in search.",
      email: { subject: "You're verified on MatchTutor ✓", html: userApprovedEmail({ name, profileUrl }) },
    });
  } else {
    await notifyUser(admin, body.tutorId, {
      type: "verification_rejected",
      title: "Verification not approved",
      body: reason
        ? `Reviewer's note: "${reason}". Update your profile and you can request another review.`
        : "An admin reviewed your profile and couldn't verify it this time. Update your profile and you can request another review.",
      email: {
        subject: "Your MatchTutor verification wasn't approved",
        html: userRejectedEmail({ name, reason, profileUrl: `${origin}/profile` }),
      },
    });
  }

  return NextResponse.json({ ok: true, status: result.status });
}
