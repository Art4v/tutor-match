// ============================================================================
// Profile image uploads (avatar + banner).
// ----------------------------------------------------------------------------
// Backed by the public Supabase Storage bucket `profile-images`, created in
// supabase/migrations/0006_profile_images.sql. Files live under a per-user
// folder (`<userId>/...`) so the storage RLS policies can scope writes to the
// owner while keeping reads public.
//
// Pass a Supabase client (use createSupabaseBrowserClient() from the editor).
// ============================================================================

export const PROFILE_IMAGES_BUCKET = "profile-images";

// Keep uploads sane — large originals slow the page and eat storage.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Upload a tutor's avatar or banner image and return its public URL.
 *
 * @param supabase a Supabase client instance
 * @param userId   the tutor's uuid (== profiles.id == auth.users.id)
 * @param kind     "avatar" | "banner"
 * @param file     a File from an <input type="file">
 *
 * Resolves to { ok: true, url } on success or { ok: false, error } on failure
 * (validation or upload). Never throws.
 */
export async function uploadProfileImage(supabase, userId, kind, file) {
  if (!file) return { ok: false, error: "No file selected." };
  if (!file.type?.startsWith("image/")) {
    return { ok: false, error: "Please choose an image file." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;

  // Cache for a year: paths are timestamped, so a replaced image gets a new
  // URL and the old cached copy simply stops being referenced. Without this,
  // Supabase serves `Cache-Control: no-cache` and every page view re-downloads
  // every image — the other driver of the cached-egress overage.
  const { error: uploadErr } = await supabase.storage
    .from(PROFILE_IMAGES_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "31536000" });
  if (uploadErr) return { ok: false, error: uploadErr.message || "Upload failed." };

  const { data } = supabase.storage.from(PROFILE_IMAGES_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) return { ok: false, error: "Could not resolve image URL." };

  return { ok: true, url: data.publicUrl };
}

// ============================================================================
// Verification supporting documents (PDF + image).
// ----------------------------------------------------------------------------
// Backed by the PRIVATE bucket `verification-docs` (migration 0033) — same
// per-user folder layout as profile images, but nothing is publicly readable.
// The owner can list/upload/delete their own folder under RLS; the admin
// review page reads via the service-role client and signed URLs. Docs are
// wiped by the approve/reject routes, so they only exist while a review is
// pending. There is no UPDATE policy on the bucket, so uploads must not use
// upsert — paths are timestamped and therefore unique anyway.
// ============================================================================

export const VERIFICATION_DOCS_BUCKET = "verification-docs";

export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB — mirrored by the bucket's file_size_limit
export const MAX_VERIFICATION_DOCS = 5; // client-side cap; size/MIME are what the bucket enforces

function isAllowedDocType(type) {
  return type === "application/pdf" || type?.startsWith("image/");
}

// Storage object keys reject many characters — keep [a-zA-Z0-9._-], collapse
// everything else, and cap the length. The display name is recovered later by
// stripping the timestamp prefix, so no separate metadata is needed.
function safeDocName(fileName) {
  const raw = String(fileName || "");
  const dot = raw.lastIndexOf(".");
  const base = (dot > 0 ? raw.slice(0, dot) : raw).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "document";
  const ext = (dot > 0 ? raw.slice(dot + 1) : "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext ? `${base}.${ext}` : base;
}

/** Strip the `<timestamp>-` upload prefix for display. */
export function docDisplayName(name) {
  return String(name || "").replace(/^\d+-/, "");
}

/**
 * Upload one verification document. Resolves to { ok, path, name } or
 * { ok: false, error }. Never throws.
 */
export async function uploadVerificationDoc(supabase, userId, file) {
  if (!file) return { ok: false, error: "No file selected." };
  if (!isAllowedDocType(file.type)) {
    return { ok: false, error: "Only PDF or image files are accepted." };
  }
  if (file.size > MAX_DOC_BYTES) {
    return { ok: false, error: "Files must be 10 MB or smaller." };
  }

  const name = `${Date.now()}-${safeDocName(file.name)}`;
  const path = `${userId}/${name}`;

  const { error } = await supabase.storage
    .from(VERIFICATION_DOCS_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) return { ok: false, error: error.message || "Upload failed." };

  return { ok: true, path, name };
}

/**
 * List the caller's uploaded documents (or any tutor's, when called with the
 * service-role client). Resolves to [{ name, path, size }], oldest first
 * (names are timestamp-prefixed and the default sort is name-ascending).
 */
export async function listVerificationDocs(supabase, userId) {
  const { data, error } = await supabase.storage.from(VERIFICATION_DOCS_BUCKET).list(userId);
  if (error || !Array.isArray(data)) return [];
  return data
    .filter((item) => item.id != null && item.name !== ".emptyFolderPlaceholder")
    .map((item) => ({ name: item.name, path: `${userId}/${item.name}`, size: item.metadata?.size ?? null }));
}

/**
 * Delete one of the caller's documents. remove() is a silent no-op when RLS
 * blocks it (empty data, no error), so an empty result counts as failure.
 */
export async function deleteVerificationDoc(supabase, userId, name) {
  const { data, error } = await supabase.storage.from(VERIFICATION_DOCS_BUCKET).remove([`${userId}/${name}`]);
  if (error) return { ok: false, error: error.message || "Could not remove the file." };
  if (!Array.isArray(data) || data.length === 0) return { ok: false, error: "Could not remove the file." };
  return { ok: true };
}

/**
 * Wipe a tutor's whole documents folder. Called by the verification
 * approve/reject routes with the SERVICE-ROLE client once a decision is made
 * (docs are only kept while a review is pending). Best-effort: never throws.
 */
export async function deleteAllVerificationDocs(admin, tutorId) {
  try {
    const docs = await listVerificationDocs(admin, tutorId);
    if (docs.length === 0) return { ok: true, removed: 0 };
    const { error } = await admin.storage.from(VERIFICATION_DOCS_BUCKET).remove(docs.map((d) => d.path));
    if (error) {
      console.error("[verification-docs] cleanup failed:", error);
      return { ok: false, removed: 0 };
    }
    return { ok: true, removed: docs.length };
  } catch (err) {
    console.error("[verification-docs] cleanup threw:", err);
    return { ok: false, removed: 0 };
  }
}
