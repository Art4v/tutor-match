import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAccountEnabled } from "@/lib/supabase/account";
import { emailAdmins } from "@/lib/admin/alerts";
import { adminManagedOptOutEmail } from "@/lib/email/send";
import { adminPaths } from "@/lib/admin/urls";
import { originOf, revalidateIndexable } from "@/lib/admin/route";
import { removeStagedFiles, sweepInviteMaterials } from "@/lib/supabase/storage";

export const runtime = "nodejs";

// POST (no body). A managed tutor (0076) takes their profile back. The RPC
// does the state change (verification to none, open draft withdrawn, private
// materials rows deleted) and returns the storage paths, which only the
// service role can remove: the tutor has no delete policy on the private
// materials bucket, by design.
export async function POST(request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!(await isAccountEnabled(supabase, user.id))) {
    return NextResponse.json({ error: "Your account is disabled." }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("opt_out_of_management");
  if (error) {
    if (error.hint === "not_managed") return NextResponse.json({ status: "not_managed" });
    console.error("[opt-out] rpc failed:", error);
    return NextResponse.json({ error: "Couldn't update this. Please try again." }, { status: 500 });
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    // The whole folder, not only the rows the RPC returned: files from a
    // failed or abandoned send were never registered, and "the documents you
    // sent at signup will be deleted" covers them too.
    await sweepInviteMaterials(admin, user.id, { extra: Array.isArray(data?.materials) ? data.materials : [] });
    await removeStagedFiles(admin, Array.isArray(data?.staged) ? data.staged : []);
  }

  const { data: me } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const origin = originOf(request);
  await emailAdmins({
    subject: "A tutor stopped admin management",
    html: adminManagedOptOutEmail({ tutorName: me?.full_name, userUrl: `${origin}${adminPaths.user(user.id)}` }),
  });

  // Verification was removed, so the machine-facing lists may have changed.
  revalidateIndexable(revalidatePath);
  return NextResponse.json({ status: "opted_out" });
}
