import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminRequest, readJson, adminRpcErrorResponse, originOf } from "@/lib/admin/route";
import { TUTOR_DOCS_BUCKET, docDisplayName, listTutorDocs, tutorDocUrl } from "@/lib/supabase/storage";
import { assertManagedTutor, isUuid, snapshotTutor, notifyManagedChange, notifyManagedDocsChange } from "../shared";

export const runtime = "nodejs";

// POST { tutorId, op, ... } (0076): a managed tutor's public documents.
//   op "add"    { path, title }  register a file the browser has just put in
//                tutor-docs/<tutorId>/ on a signed upload URL (see ../upload).
//   op "rename" { docId, title }
//   op "delete" { docId }        the RPC returns the row's own storage path,
//                which the service role then removes.
//   op "notify" { before: [{ id, title }] }  one "what changed" email for a
//                whole Documentation save, diffing `before` against the live
//                list now.
// The RPCs re-check admin + managed. `quiet: true` skips the per-op email: the
// admin editor sends its ops quietly and then one "notify", so a Save that
// touches five documents sends the tutor one email, not five.
export async function POST(request) {
  const gate = await requireAdminRequest();
  if (gate.res) return gate.res;
  const { supabase } = gate;

  const body = await readJson(request);
  const op = body?.op;
  if (!isUuid(body?.tutorId) || !["add", "rename", "delete", "notify"].includes(op)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if ((op === "rename" || op === "delete") && !isUuid(body?.docId)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const tutorId = body.tutorId;
  const quiet = body.quiet === true;
  const admin = createSupabaseAdminClient();
  const origin = originOf(request);

  if (op === "notify") {
    const refused = await assertManagedTutor(admin, tutorId);
    if (refused) return refused;
    const before = (Array.isArray(body.before) ? body.before : []).filter((d) => isUuid(d?.id));
    await notifyManagedDocsChange(admin, tutorId, before, await listTutorDocs(admin, tutorId), origin);
    return NextResponse.json({ ok: true });
  }

  const before = !quiet && admin ? await snapshotTutor(admin, tutorId) : null;
  const notify = async () => {
    if (quiet || !admin) return;
    await notifyManagedChange(admin, tutorId, before, await snapshotTutor(admin, tutorId), origin);
  };

  if (op === "add") {
    const path = typeof body.path === "string" ? body.path : "";
    if (!path.startsWith(`${tutorId}/`)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const title = String(body.title ?? "").trim() || docDisplayName(path.slice(tutorId.length + 1));
    const { data: id, error } = await supabase.rpc("admin_add_managed_tutor_document", {
      p_tutor_id: tutorId,
      p_path: path,
      p_title: title,
    });
    if (error || !id) {
      // The row is what makes the file visible, so take the file back, unless
      // a document row already points at it (never delete someone's file).
      if (admin) {
        const { data: inUse } = await admin
          .from("tutor_documents")
          .select("id")
          .eq("storage_path", path)
          .limit(1)
          .maybeSingle();
        if (!inUse) await admin.storage.from(TUTOR_DOCS_BUCKET).remove([path]);
      }
      return adminRpcErrorResponse(error, "Upload failed.");
    }
    await notify();
    return NextResponse.json({ ok: true, id, title, path, url: tutorDocUrl(admin ?? supabase, path) });
  }

  if (op === "rename") {
    const { data, error } = await supabase.rpc("admin_rename_managed_tutor_document", {
      p_tutor_id: tutorId,
      p_id: body.docId,
      p_title: body.title ?? "",
    });
    if (error) return adminRpcErrorResponse(error, "Could not rename the document.");
    await notify();
    return NextResponse.json({ ok: true, title: data });
  }

  const { data: path, error } = await supabase.rpc("admin_delete_managed_tutor_document", {
    p_tutor_id: tutorId,
    p_id: body.docId,
  });
  if (error) return adminRpcErrorResponse(error, "Could not remove the document.");
  if (admin && path) await admin.storage.from(TUTOR_DOCS_BUCKET).remove([path]);
  await notify();
  return NextResponse.json({ ok: true });
}
