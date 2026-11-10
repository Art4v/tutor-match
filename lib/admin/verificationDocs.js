// SERVER-ONLY. Every function here takes the service-role client.
//
// Private supporting documents (0079). Reaching `verified` flags a tutor's rows
// in the database; purgeVerificationDocs is the second half, since a storage
// file cannot be removed from SQL. It deletes a row only once its file is
// confirmed gone, so a flagged row always means "this file may still exist".

import {
  VERIFICATION_DOCS_BUCKET,
  listVerificationDocPaths,
  signVerificationDocUrls,
} from "@/lib/supabase/storage";

/**
 * Removes a tutor's flagged files, plus any file in their folder that no row
 * points at (an upload that was never registered). Returns { ok, remaining },
 * where `remaining` is how many flagged rows are still stored. Never throws.
 */
export async function purgeVerificationDocs(admin, tutorId) {
  if (!admin || !tutorId) return { ok: false, remaining: 0 };
  try {
    const { data: rows, error } = await admin.rpc("list_tutor_verification_documents", {
      p_tutor_id: tutorId,
    });
    if (error) throw error;

    const flagged = (rows ?? []).filter((r) => r.purge_requested_at);
    const remaining = flagged.length;
    const keep = new Set((rows ?? []).filter((r) => !r.purge_requested_at).map((r) => r.storage_path));

    const inFolder = await listVerificationDocPaths(admin, tutorId);
    if (inFolder === null) return { ok: false, remaining };

    const toRemove = inFolder.filter((p) => !keep.has(p));
    if (toRemove.length > 0) {
      const { error: rmErr } = await admin.storage.from(VERIFICATION_DOCS_BUCKET).remove(toRemove);
      if (rmErr) {
        console.error("[verification docs] remove failed:", rmErr);
        return { ok: false, remaining };
      }
      // remove() reports success for a path it skipped, so look again.
      const after = await listVerificationDocPaths(admin, tutorId);
      if (after === null || after.some((p) => !keep.has(p))) return { ok: false, remaining };
    }

    if (flagged.length > 0) {
      const { error: delErr } = await admin.rpc("delete_flagged_verification_documents", {
        p_tutor_id: tutorId,
        p_ids: flagged.map((r) => r.id),
      });
      if (delErr) {
        console.error("[verification docs] row delete failed:", delErr);
        return { ok: false, remaining };
      }
    }
    return { ok: true, remaining: 0 };
  } catch (err) {
    console.error("[verification docs] purge threw:", err);
    return { ok: false, remaining: 0 };
  }
}

/**
 * What the admin pages show: the tutor's current files with signed links, and
 * how many flagged files are still waiting to be deleted.
 */
export async function getVerificationDocsForAdmin(admin, tutorId) {
  const { data: rows, error } = await admin.rpc("list_tutor_verification_documents", {
    p_tutor_id: tutorId,
  });
  if (error) {
    console.error("[verification docs] read failed:", error);
    return { docs: [], purgePending: 0 };
  }

  const active = (rows ?? []).filter((r) => !r.purge_requested_at);
  const urls = await signVerificationDocUrls(admin, active.map((r) => r.storage_path));
  return {
    docs: active.map((r) => ({
      id: r.id,
      fileName: r.file_name,
      uploadedAt: r.uploaded_at,
      url: urls[r.storage_path] ?? null,
    })),
    purgePending: (rows ?? []).length - active.length,
  };
}

/** How many files a tutor has saved for their next request. */
export async function countSavedVerificationDocs(admin, tutorId) {
  if (!admin) return 0;
  const { data: rows } = await admin.rpc("list_tutor_verification_documents", {
    p_tutor_id: tutorId,
  });
  return (rows ?? []).filter((r) => !r.purge_requested_at).length;
}
