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
