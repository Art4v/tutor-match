import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAccountEnabled } from "@/lib/supabase/account";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  INVITE_MATERIALS_BUCKET,
  MAX_INVITE_FOLDER_FILES,
  inviteDocFileError,
  listInviteMaterialPaths,
  tutorDocPath,
} from "@/lib/supabase/storage";

export const runtime = "nodejs";

// POST { name, type, size } from /join/details (0076). The signup-materials
// bucket has no client policies, so this is the only way a file gets in: after
// the session, can_upload_invite_materials (managed, not yet submitted), the
// type and size, and the folder count, it mints a signed upload URL for one
// path in the caller's own folder, and the browser uploads the file straight
// to Storage with it (lib/supabase/storage.js uploadInviteMaterial). The bytes
// never pass through this function: the host caps a request body at 4.5 MB,
// below the 10 MB a document may be. The bucket's own size and MIME limits
// still apply to the upload itself, since `type` here is what the browser says.
// Responds { path, token }.
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

  // Soft (per instance); the folder count below is the real cap.
  const limit = checkRateLimit(`join-materials-upload:${user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const type = typeof body?.type === "string" ? body.type : "";
  const size = Number(body?.size) || 0;
  const name = typeof body?.name === "string" ? body.name : "";
  const invalid = inviteDocFileError({ type, size });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Uploads are not available right now." }, { status: 503 });
  }

  const { data: allowed, error: gateErr } = await admin.rpc("can_upload_invite_materials", { p_id: user.id });
  if (gateErr) {
    console.error("[join] upload gate failed:", gateErr);
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }
  if (allowed !== true) {
    return NextResponse.json({ error: "You have already sent your documents." }, { status: 403 });
  }

  // Fail closed: without a listing we cannot tell how full the folder is.
  const existing = await listInviteMaterialPaths(admin, user.id);
  if (existing === null) {
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }
  if (existing.length >= MAX_INVITE_FOLDER_FILES) {
    return NextResponse.json(
      { error: "You've uploaded too many files. Send what you have, or skip." },
      { status: 409 }
    );
  }

  const { path } = tutorDocPath(user.id, name);
  const { data, error } = await admin.storage.from(INVITE_MATERIALS_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) {
    console.error("[join] could not sign an upload:", error);
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ path: data.path || path, token: data.token });
}
