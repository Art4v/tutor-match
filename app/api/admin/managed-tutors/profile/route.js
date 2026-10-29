import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminRequest, readJson, adminRpcErrorResponse, originOf, revalidateIndexable } from "@/lib/admin/route";
import { isUuid, snapshotTutor, notifyManagedChange } from "../shared";

export const runtime = "nodejs";

// POST { tutorId, payload, expectedUpdatedAt } from the admin editor (0076).
// payload is exactly what save_tutor_profile takes (buildSaveProfilePayload +
// full_name). The write is admin_save_managed_tutor_profile, through the
// caller's own client; the before/after snapshots only feed the tutor's "what
// changed" email. expectedUpdatedAt is the version the editor holds: a newer
// profile (another admin's save, an approved draft) is refused with 409, since
// the payload would silently revert it. Responds with the new version.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  if (!isUuid(body?.tutorId) || !body?.payload || typeof body.payload !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const before = admin ? await snapshotTutor(admin, body.tutorId) : null;

  const { data, error } = await supabase.rpc("admin_save_managed_tutor_profile", {
    p_tutor_id: body.tutorId,
    p_payload: body.payload,
    p_expected_updated_at: typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : null,
  });
  if (error) {
    if (error.hint === "invalid_image_url") {
      return NextResponse.json({ error: "That photo could not be saved. Please upload it again." }, { status: 400 });
    }
    if (error.hint === "stale_profile") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return adminRpcErrorResponse(error, "Could not save the profile, please try again.");
  }

  if (data?.changed && admin) {
    const after = await snapshotTutor(admin, body.tutorId);
    await notifyManagedChange(admin, body.tutorId, before, after, originOf(request));
    revalidateIndexable(revalidatePath);
  }

  const droppedSubjects = Array.isArray(data?.dropped_subjects) ? data.dropped_subjects : [];
  return NextResponse.json({ ok: true, changed: !!data?.changed, droppedSubjects, updatedAt: data?.updated_at ?? null });
}
