// ============================================================================
// Profile revisions: a verified tutor's reviewed draft (migration 0072).
// ----------------------------------------------------------------------------
// The only path to tutor_profile_revisions, the way lib/supabase/tutors.js is
// for tutor_profiles. Owner helpers take the user-scoped client (RLS gives the
// owner read access to their own rows; every write is an RPC). The moderation
// loader takes the service-role client, called by the /admin pages after their
// admin guard.
// ============================================================================

import { buildSaveProfilePayload, getTutorProfileForEditor, getSubjects } from "./tutors";
import { listTutorDocs, removeStagedFiles, signStagedUrls } from "./storage";
import { collectStagedPaths, docsListToPayload, payloadDocsToList, payloadToEditor } from "@/lib/profileRevision";

const REVISION_SELECT =
  "id, tutor_id, status, payload, reason, created_at, updated_at, submitted_at, admin_notified_at, decided_at, parent:parent_id ( status, reason )";

/** Row -> the camelCase shape the UI uses. */
function revisionRowToMeta(row) {
  if (!row) return null;
  return {
    id: row.id,
    tutorId: row.tutor_id,
    status: row.status,
    payload: row.payload,
    submittedAt: row.submitted_at ?? null,
    adminNotifiedAt: row.admin_notified_at ?? null,
    decidedAt: row.decided_at ?? null,
    reason: row.reason ?? null,
    // A draft re-opened by a rejection carries the admin's reason on its
    // parent; the owner card shows it until the next submission.
    rejectedReason: row.parent?.status === "rejected" ? row.parent.reason ?? "" : null,
    rejected: row.parent?.status === "rejected",
  };
}

/** The caller's open revision (a draft or a submission under review), or null. */
export async function getMyOpenRevision(supabase, tutorId) {
  const { data, error } = await supabase
    .from("tutor_profile_revisions")
    .select(REVISION_SELECT)
    .eq("tutor_id", tutorId)
    .in("status", ["draft", "pending"])
    .maybeSingle();
  if (error) {
    console.error("[revisions] could not load open revision:", error);
    return null;
  }
  return revisionRowToMeta(data);
}

/**
 * Save the editor state + documentation list as the caller's draft. Any staged
 * files the previous draft referenced and this one doesn't are deleted
 * (best-effort). Resolves to { ok, revisionId, withdrewSubmission } or
 * { ok: false, error }.
 */
export async function saveProfileDraft(supabase, tutor, docs) {
  const name = (tutor.name ?? "").trim();
  if (!name) return { ok: false, error: { message: "Your full name is required." } };

  const payload = {
    full_name: name,
    ...buildSaveProfilePayload(tutor),
    documents: docsListToPayload(docs),
  };
  delete payload.profile.visibility;

  const { data, error } = await supabase.rpc("save_profile_draft", { p_payload: payload });
  if (error) return { ok: false, error };

  await removeStagedFiles(supabase, data?.orphaned_staged ?? []);
  return {
    ok: true,
    revisionId: data?.revision_id ?? null,
    withdrewSubmission: data?.withdrew_submission === true,
  };
}

/** Drop the caller's draft (or submission) and its staged files. */
export async function discardProfileDraft(supabase) {
  const { data, error } = await supabase.rpc("discard_profile_draft");
  if (error) return { ok: false, error };
  await removeStagedFiles(supabase, data?.staged ?? []);
  return { ok: true };
}

/**
 * Everything the admin review page and the preview need for one revision,
 * via the SERVICE-ROLE client. Returns null when the revision doesn't exist.
 *
 * { revision, tutorName, slug, accountStatus, gated,
 *   live, liveDocs, draft, draftDocs, signed, subjectCatalog }
 * `draft` / `draftDocs` are built from the revision's payload, with staged
 * files previewable through `signed` ({ path: signedUrl }).
 */
export async function getRevisionForModeration(admin, revisionId) {
  const { data: row, error } = await admin
    .from("tutor_profile_revisions")
    .select(REVISION_SELECT)
    .eq("id", revisionId)
    .maybeSingle();
  if (error || !row) return null;

  const revision = revisionRowToMeta(row);
  const [live, liveDocs, subjectCatalog, { data: account }] = await Promise.all([
    getTutorProfileForEditor(admin, row.tutor_id),
    listTutorDocs(admin, row.tutor_id),
    getSubjects(admin),
    admin.from("profiles").select("status").eq("id", row.tutor_id).maybeSingle(),
  ]);
  if (!live) return null;

  const signed = await signStagedUrls(admin, collectStagedPaths(row.payload));
  return {
    revision,
    tutorName: live.name || "This tutor",
    slug: live.slug,
    accountStatus: account?.status ?? "enabled",
    gated: live.gated,
    live,
    liveDocs,
    draft: payloadToEditor(row.payload, live),
    draftDocs: payloadDocsToList(row.payload, liveDocs, signed),
    signed,
    subjectCatalog,
  };
}
