// Shared by the /api/admin/managed-tutors routes (0076, 0081; not itself a
// route). The RPCs are the boundary for every database write; this exists for
// the one thing they cannot cover, file uploads, which must land in the
// tutor's folder BEFORE an RPC references them. Hence the managed check here.

import { NextResponse } from "next/server";
import { notifyUser } from "@/lib/notifications";
import { managedSetupReadyEmail } from "@/lib/email/send";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

/** Stages in which an admin may edit a managed tutor's profile (0081). */
export const EDITABLE_STAGES = ["setup", "changes_requested"];

/**
 * Is `tutorId` a managed, non-company tutor who is not an admin? Read through
 * the service role. Returns null when it is, else a response to return.
 * `editable: true` also requires the profile to be with the admins (not sent
 * to the tutor or approved by them), mirroring _assert_managed_editable.
 */
export async function assertManagedTutor(admin, tutorId, { editable = false } = {}) {
  if (!admin) return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
  if (!isUuid(tutorId)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { data } = await admin
    .from("tutor_profiles")
    .select("managed_at, partner_id, profile:profiles!inner ( is_admin )")
    .eq("id", tutorId)
    .maybeSingle();
  if (!data?.managed_at || data.partner_id || data.profile?.is_admin) {
    return NextResponse.json({ error: "This tutor is not managed by MatchTutor." }, { status: 403 });
  }
  if (editable) {
    const { data: setup } = await admin
      .from("tutor_managed_setup")
      .select("stage")
      .eq("tutor_id", tutorId)
      .maybeSingle();
    if (!EDITABLE_STAGES.includes(setup?.stage ?? "setup")) {
      return NextResponse.json({ error: "This profile is with the tutor. Recall it before you edit." }, { status: 409 });
    }
  }
  return null;
}

/**
 * Tell the tutor their profile is ready to approve (a send, or a resend with
 * `reminder`). The button opens /profile, which sends them to their own
 * profile page behind a login; the Approve button lives there.
 */
export async function notifySetupReady(admin, tutorId, { name, message, origin, reminder = false }) {
  await notifyUser(admin, tutorId, {
    type: "managed_setup_ready",
    title: reminder ? "Reminder: your profile is ready to review" : "Your profile is ready to review",
    body: message || "Open your profile to approve it or tell us what to change.",
    email: {
      subject: reminder ? "Reminder: your MatchTutor profile is ready to review" : "Your MatchTutor profile is ready to review",
      html: managedSetupReadyEmail({ name, message, profileUrl: `${origin}/profile`, reminder }),
    },
  });
}
