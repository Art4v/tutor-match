import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { VERIFICATION_DOCS_BUCKET, listVerificationDocPaths } from "@/lib/supabase/storage";

export const runtime = "nodejs";

const RETRY = "Couldn't delete your account. Please try again.";

// POST: deletes the caller's account. Private verification documents (0079) are
// removed FIRST, because deleting the account takes away the rows that say what
// is stored, and a person's ID must not outlive their account. If the files
// can't be removed the account is left alone so the tutor can try again.
export async function POST(request) {
  // JSON only, so a cross-site form post can't reach this.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: RETRY }, { status: 503 });

  const paths = await listVerificationDocPaths(admin, user.id);
  if (paths === null) return NextResponse.json({ error: RETRY }, { status: 500 });
  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage.from(VERIFICATION_DOCS_BUCKET).remove(paths);
    const after = rmErr ? null : await listVerificationDocPaths(admin, user.id);
    if (after === null || after.length > 0) {
      console.error("[account delete] could not remove verification documents:", rmErr);
      return NextResponse.json({ error: RETRY }, { status: 500 });
    }
  }

  // Through the caller's own client: the RPC deletes auth.uid().
  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    console.error("[account delete] rpc failed:", error);
    return NextResponse.json({ error: RETRY }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
