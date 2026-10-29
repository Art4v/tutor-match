import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminRequest, readJson } from "@/lib/admin/route";
import {
  docFileError,
  tutorDocPath,
  profileImagePath,
  MAX_IMAGE_BYTES,
  PROFILE_IMAGES_BUCKET,
  TUTOR_DOCS_BUCKET,
} from "@/lib/supabase/storage";
import { assertManagedTutor } from "../shared";

export const runtime = "nodejs";

// POST { tutorId, kind: "avatar" | "banner" | "document", name, type, size }
// (0076). The admin's session cannot write into another tutor's storage
// folder, so after the admin check and the managed check this mints a signed
// upload URL for a path in the TUTOR's folder, and the browser uploads the
// file straight to Storage with it (lib/admin/managedTutorWriter.js), the way
// a tutor's own uploads go. The bytes never pass through this function: the
// host caps a function's request body (4.5 MB on Vercel) well below the 10 MB
// a document may be.
//   avatar / banner -> the photo persists when the admin saves the header
//     (admin_save_managed_tutor_profile checks it is in this folder).
//   document -> registered afterwards by /api/admin/managed-tutors/documents
//     (op "add", admin_add_managed_tutor_document checks the file exists).
// Responds { bucket, path, token, cacheControl? }. The bucket's own size and
// MIME limits still apply to the upload itself.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;

  const body = await readJson(request);
  const kind = body?.kind;
  if (!["avatar", "banner", "document"].includes(kind)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const type = typeof body?.type === "string" ? body.type : "";
  const size = Number(body?.size) || 0;
  const name = typeof body?.name === "string" ? body.name : "";

  const admin = createSupabaseAdminClient();
  const refused = await assertManagedTutor(admin, body?.tutorId);
  if (refused) return refused;
  const tutorId = body.tutorId;

  let bucket;
  let path;
  let cacheControl;
  if (kind === "document") {
    const invalid = docFileError({ type, size });
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    bucket = TUTOR_DOCS_BUCKET;
    path = tutorDocPath(tutorId, name).path;
  } else {
    if (!type.startsWith("image/")) {
      return NextResponse.json({ error: "Please choose an image file." }, { status: 400 });
    }
    if (size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
    }
    bucket = PROFILE_IMAGES_BUCKET;
    path = profileImagePath(tutorId, kind, name);
    // Same as uploadProfileImage: timestamped paths, so cache for a year.
    cacheControl = "31536000";
  }

  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data?.token) {
    console.error("[managed upload] could not sign an upload:", error);
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ bucket, path: data.path || path, token: data.token, cacheControl });
}
