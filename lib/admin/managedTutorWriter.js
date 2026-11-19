// ============================================================================
// The admin editor's write adapter for a managed tutor (0076), client-side.
// ----------------------------------------------------------------------------
// OwnerProfile in admin mode calls these instead of the tutor's own helpers.
// Each one POSTs to an /api/admin/managed-tutors route, which re-checks the
// caller is an admin, the tutor is still managed and the profile is not with
// the tutor (0081: no edits while `sent` or `approved`). The RPCs are the
// boundary. Nothing here emails the tutor: they hear from us when the profile
// is sent to them for approval. Return shapes match the helpers they stand in for, so the editor
// needs no second code path beyond picking the writer.
//
// Files go straight from the browser to Storage, on a signed upload URL the
// upload route mints after its checks, like a tutor's own uploads. Posting
// them through a route handler would hit the host's request-body cap (4.5 MB
// on Vercel) well below the 10 MB a document may be.
// ============================================================================

import { buildSaveProfilePayload } from "@/lib/supabase/tutors";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

async function post(path, body) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || "Something went wrong. Please try again." };
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

// Errors come back as strings from the routes; the editor reads `.message`
// for profile saves (like a Supabase error) and the string for the rest.
const asError = (r) => (r.ok ? r : { ok: false, error: { message: r.error } });

export function adminTutorWriter(tutorId) {
  const base = "/api/admin/managed-tutors";
  let storage = null;
  const bucket = (id) => {
    if (!storage) storage = createSupabaseBrowserClient().storage;
    return storage.from(id);
  };

  // Ask the route for a slot in the tutor's folder, then upload to it.
  // Resolves to { ok, bucket, path } or { ok: false, error }.
  async function uploadFile(kind, file) {
    if (!file) return { ok: false, error: "No file selected." };
    const slot = await post(`${base}/upload`, { tutorId, kind, name: file.name ?? "", type: file.type ?? "", size: file.size ?? 0 });
    if (!slot.ok) return slot;
    const options = { contentType: file.type };
    if (slot.cacheControl) options.cacheControl = slot.cacheControl;
    const { error } = await bucket(slot.bucket).uploadToSignedUrl(slot.path, slot.token, file, options);
    if (error) return { ok: false, error: error.message || "Upload failed." };
    return { ok: true, bucket: slot.bucket, path: slot.path };
  }

  return {
    async saveProfile(tutor) {
      const name = (tutor.name ?? "").trim();
      if (!name) return { ok: false, error: { message: "The tutor's full name is required." } };
      const r = await post(`${base}/profile`, {
        tutorId,
        payload: { full_name: name, ...buildSaveProfilePayload(tutor) },
        // The version this editor holds; a newer live profile is refused (409)
        // rather than overwritten with this page's older copy.
        expectedUpdatedAt: tutor.updatedAt ?? null,
      });
      if (!r.ok) return asError(r);
      return { ok: true, droppedSubjects: r.droppedSubjects ?? [], verificationWithdrawn: false, updatedAt: r.updatedAt ?? null };
    },

    // BannerAvatarSection's upload prop: (file, kind) -> { ok, url } | { ok, error }.
    async uploadImage(file, kind) {
      const up = await uploadFile(kind === "banner" ? "banner" : "avatar", file);
      if (!up.ok) return up;
      const { data } = bucket(up.bucket).getPublicUrl(up.path);
      return data?.publicUrl ? { ok: true, url: data.publicUrl } : { ok: false, error: "Could not resolve image URL." };
    },

    // DocumentationUploader's live ops.
    docs: {
      async upload(file, title) {
        const up = await uploadFile("document", file);
        if (!up.ok) return up;
        return post(`${base}/documents`, { tutorId, op: "add", path: up.path, title: title || "" });
      },
      async rename(item, title) {
        return post(`${base}/documents`, { tutorId, op: "rename", docId: item.id, title });
      },
      async remove(item) {
        return post(`${base}/documents`, { tutorId, op: "delete", docId: item.id });
      },
    },
  };
}
