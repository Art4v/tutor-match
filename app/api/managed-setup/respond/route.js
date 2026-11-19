import { NextResponse } from "next/server";
import { emailAdmins } from "@/lib/admin/alerts";
import { adminManagedResponseEmail } from "@/lib/email/send";
import { adminPaths } from "@/lib/admin/urls";
import { originOf } from "@/lib/admin/route";
import { requireTutorRequest, setupRpcErrorResponse } from "../shared";

export const runtime = "nodejs";

// POST { decision: "approve" | "changes", note? } (0081). A managed tutor
// answers the profile an admin sent them: approve it, or ask for changes with
// a note (required, 500 characters). respond_managed_setup applies only while
// the profile is with the tutor; a Recall or an earlier answer returns
// { applied: false, stage } and nobody is emailed. On a real answer the
// admins are alerted with a link to the tutor's dashboard page.
export async function POST(request) {
  const gate = await requireTutorRequest("managed-respond");
  if (gate.res) return gate.res;
  const { supabase, user } = gate;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (body?.decision !== "approve" && body?.decision !== "changes") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const approve = body.decision === "approve";
  const note = approve ? null : String(body.note ?? "").trim();
  if (!approve && !note) {
    return NextResponse.json({ error: "Tell us what to change." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("respond_managed_setup", { p_approve: approve, p_note: note });
  if (error) return setupRpcErrorResponse(error, "Could not send your answer. Please try again.");
  if (!data?.applied) {
    return NextResponse.json({ ok: true, applied: false, stage: data?.stage ?? "setup" });
  }

  await emailAdmins({
    subject: approve ? "A tutor approved their profile" : "A tutor asked for changes to their profile",
    html: adminManagedResponseEmail({
      tutorName: data.name,
      approved: approve,
      note: data.note,
      reviewUrl: `${originOf(request)}${adminPaths.managedTutor(user.id)}`,
    }),
  });
  return NextResponse.json({ ok: true, applied: true, stage: data.stage, changeNote: data.note ?? null });
}
