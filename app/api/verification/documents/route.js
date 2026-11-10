import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAccountEnabled } from "@/lib/supabase/account";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  MAX_VERIFICATION_DOCS,
  MAX_VERIFICATION_FOLDER_FILES,
  VERIFICATION_DOCS_BUCKET,
  inviteDocFileError,
  listVerificationDocPaths,
  signVerificationDocUrls,
  tutorDocPath,
} from "@/lib/supabase/storage";

export const runtime = "nodejs";

// A tutor's own private supporting documents (0079). The bucket has no client
// policies, so this route is the only way in or out: GET lists them with signed
// links, POST signs one upload (the browser sends the bytes straight to Storage
// because the host caps a function body at 4.5 MB, then registers the file with
// add_verification_document), and DELETE removes one.

async function session() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  }
  // middleware exempts /api, so enforce "not disabled" here (0052).
  if (!(await isAccountEnabled(supabase, user.id))) {
    return { res: NextResponse.json({ error: "Your account is disabled." }, { status: 403 }) };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { res: NextResponse.json({ error: "Documents are not available right now." }, { status: 503 }) };
  }
  return { supabase, user, admin };
}

export async function GET() {
  const s = await session();
  if (s.res) return s.res;

  const { data: rows, error } = await s.supabase.rpc("list_my_verification_documents");
  if (error) {
    console.error("[verification docs] list failed:", error);
    return NextResponse.json({ error: "Could not load your documents." }, { status: 500 });
  }

  const urls = await signVerificationDocUrls(s.admin, (rows ?? []).map((r) => r.storage_path));
  return NextResponse.json({
    docs: (rows ?? []).map((r) => ({ id: r.id, fileName: r.file_name, url: urls[r.storage_path] ?? null })),
  });
}

// POST { name, type, size } -> { path, token }.
export async function POST(request) {
  const s = await session();
  if (s.res) return s.res;
  const { supabase, user, admin } = s;

  // Soft (per instance); the counts below are the real caps.
  const limit = checkRateLimit(`verification-docs-upload:${user.id}`, { limit: 40, windowMs: 60 * 60 * 1000 });
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

  // An early answer only: add_verification_document re-checks under a lock.
  const { data: tutor } = await supabase
    .from("tutor_profiles")
    .select("verification_status, managed_at, partner_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!tutor || tutor.managed_at || tutor.partner_id) {
    return NextResponse.json({ error: "Documents can't be added to this profile." }, { status: 403 });
  }
  if (tutor.verification_status === "pending") {
    return NextResponse.json({ error: "Your documents are locked while your request is under review." }, { status: 409 });
  }
  if (tutor.verification_status === "verified") {
    return NextResponse.json({ error: "You are already verified." }, { status: 409 });
  }

  const { data: saved } = await supabase.rpc("list_my_verification_documents");
  if ((saved?.length ?? 0) >= MAX_VERIFICATION_DOCS) {
    return NextResponse.json({ error: `You can attach up to ${MAX_VERIFICATION_DOCS} documents.` }, { status: 409 });
  }

  // Fail closed: without a listing we cannot tell how full the folder is.
  const existing = await listVerificationDocPaths(admin, user.id);
  if (existing === null) {
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }
  if (existing.length >= MAX_VERIFICATION_FOLDER_FILES) {
    return NextResponse.json({ error: "Too many files are stored. Remove one and try again." }, { status: 409 });
  }

  const { path } = tutorDocPath(user.id, name);
  const { data, error } = await admin.storage.from(VERIFICATION_DOCS_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) {
    console.error("[verification docs] could not sign an upload:", error);
    return NextResponse.json({ error: "Could not start the upload. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ path: data.path || path, token: data.token });
}

// DELETE { id } removes a registered document. DELETE { path } cleans up a file
// that uploaded but could not be registered, so it never touches a registered
// file (those must go through the RPC's status gate).
export async function DELETE(request) {
  const s = await session();
  if (s.res) return s.res;
  const { supabase, user, admin } = s;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const bucket = admin.storage.from(VERIFICATION_DOCS_BUCKET);

  if (typeof body?.path === "string") {
    const parts = body.path.split("/");
    if (parts.length !== 2 || parts[0] !== user.id || !parts[1]) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const { data: rows, error: readErr } = await admin.rpc("list_tutor_verification_documents", {
      p_tutor_id: user.id,
    });
    // Fail closed: without the rows we can't tell whether this file is registered.
    if (readErr) {
      console.error("[verification docs] list failed:", readErr);
      return NextResponse.json({ error: "Could not remove the file." }, { status: 500 });
    }
    if ((rows ?? []).some((r) => r.storage_path === body.path)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    await bucket.remove([body.path]);
    return NextResponse.json({ ok: true });
  }

  if (typeof body?.id !== "string") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: saved } = await supabase.rpc("list_my_verification_documents");
  const row = (saved ?? []).find((d) => d.id === body.id);
  if (!row) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const { data: path, error } = await supabase.rpc("remove_verification_document", { p_id: body.id });
  if (error) {
    const known = error.code === "22023" || error.code === "P0002";
    return NextResponse.json(
      { error: known ? error.message : "Could not remove the document." },
      { status: known ? 409 : 500 }
    );
  }

  const { error: rmErr } = await bucket.remove([path]);
  if (rmErr) {
    // Never tell a tutor a sensitive file is gone while it is still stored:
    // put the row back so the file stays visible and removable.
    console.error("[verification docs] remove failed:", rmErr);
    await supabase.rpc("add_verification_document", { p_path: path, p_file_name: row.file_name });
    return NextResponse.json({ error: "Could not remove the document. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
