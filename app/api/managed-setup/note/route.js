import { NextResponse } from "next/server";
import { emailAdmins } from "@/lib/admin/alerts";
import { adminManagedNoteEmail } from "@/lib/email/send";
import { adminPaths } from "@/lib/admin/urls";
import { originOf } from "@/lib/admin/route";
import { requireTutorRequest, setupRpcErrorResponse } from "../shared";

export const runtime = "nodejs";

// POST { note } (0081). A managed tutor's one editable note for the team, at
// any stage of setup (2000 characters; empty clears it). The admins are
// emailed on every real change (by decision), never for a save that changed
// nothing.
export async function POST(request) {
  const gate = await requireTutorRequest("managed-note");
  if (gate.res) return gate.res;
  const { supabase, user } = gate;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body?.note !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("save_managed_note", { p_note: body.note });
  if (error) return setupRpcErrorResponse(error, "Could not save your note. Please try again.");

  if (data?.changed) {
    const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    await emailAdmins({
      subject: data.note ? "A tutor left a note on their managed profile" : "A tutor cleared the note on their managed profile",
      html: adminManagedNoteEmail({
        tutorName: me?.full_name,
        note: data.note,
        reviewUrl: `${originOf(request)}${adminPaths.managedTutor(user.id)}`
      }),
    });
  }
  return NextResponse.json({ ok: true, changed: !!data?.changed, note: data?.note ?? "" });
}
