import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notifyUser } from "@/lib/notifications";
import { managedProfileUpdatedEmail } from "@/lib/email/send";
import { requireAdminRequest, readJson, adminRpcErrorResponse, originOf, revalidateIndexable } from "@/lib/admin/route";
import { isUuid } from "../shared";

export const runtime = "nodejs";

// POST { tutorId, visibility: "public" | "hidden" } (0076). Visibility is
// admin-only while a tutor is managed; the tutor is told either way.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  if (!isUuid(body?.tutorId) || !["public", "hidden"].includes(body?.visibility)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("admin_set_managed_tutor_visibility", {
    p_tutor_id: body.tutorId,
    p_visibility: body.visibility,
  });
  if (error) return adminRpcErrorResponse(error, "Could not change visibility, please try again.");

  if (data?.applied) {
    revalidateIndexable(revalidatePath);
    const admin = createSupabaseAdminClient();
    const { data: row } = admin
      ? await admin.from("tutor_profiles").select("slug, profile:profiles!inner ( full_name )").eq("id", body.tutorId).maybeSingle()
      : { data: null };
    const origin = originOf(request);
    const line = body.visibility === "public" ? "Your profile is now public" : "Your profile is now hidden";
    await notifyUser(admin, body.tutorId, {
      type: "managed_profile_updated",
      title: body.visibility === "public" ? "Your profile is live" : "Your profile is hidden",
      body: line,
      email: {
        subject: body.visibility === "public" ? "Your MatchTutor profile is live" : "Your MatchTutor profile is hidden",
        html: managedProfileUpdatedEmail({
          name: row?.profile?.full_name,
          changes: [line],
          profileUrl: row?.slug ? `${origin}/tutor/${row.slug}` : `${origin}/profile`,
        }),
      },
    });
  }
  // updatedAt: the profile's new version, which the editor adopts so its next
  // section save is not refused as stale.
  return NextResponse.json({ ok: true, applied: !!data?.applied, visibility: data?.visibility, updatedAt: data?.updated_at ?? null });
}
