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

import { downscaleImage } from "@/lib/image";

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
// Blog cover art (migration 0061).
// ----------------------------------------------------------------------------
// The PUBLIC `blog-images` bucket, same per-user folder layout as profile
// images and the same 5 MB / image-only limits (enforced by the bucket too).
//
// The folder is NOT cosmetic: articles carries a CHECK constraint
// (articles_cover_in_author_folder) requiring the stored path to start with the
// author's uuid, and the bucket's owner policy only admits writes to that
// folder. Upload somewhere else and the row insert fails, not the upload.
// ============================================================================

export const BLOG_IMAGES_BUCKET = "blog-images";

/**
 * Upload an article cover. Returns { ok: true, path, url } or { ok, error }.
 * Never throws. Returns the PATH as well as the URL because that is what the
 * articles row stores — a full URL would bake the project ref into the data.
 */
export async function uploadArticleCover(supabase, userId, file) {
  if (!file) return { ok: false, error: "No file selected." };
  if (!file.type?.startsWith("image/")) {
    return { ok: false, error: "Please choose an image file." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/cover-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BLOG_IMAGES_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "31536000" });
  if (uploadErr) return { ok: false, error: uploadErr.message || "Upload failed." };

  const { data } = supabase.storage.from(BLOG_IMAGES_BUCKET).getPublicUrl(path);
  return { ok: true, path, url: data?.publicUrl ?? null };
}

/**
 * Public URL for a blog-images path. Pure string building, like tutorDocUrl,
 * but it takes NO supabase client: ArticleBody renders body images on the
 * public article page, where no client is in scope (app/blog/[slug]/page.js
 * passes only nodes), and again in the client editor preview. Reading
 * NEXT_PUBLIC_SUPABASE_URL directly is what lets bodies store paths instead of
 * URLs, which is the invariant above. Produces the same string getPublicUrl
 * does, from the same template as scripts/migrate-profile-images.mjs.
 */
export function blogImageUrl(path) {
  if (!path || typeof path !== "string") return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const key = path.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${BLOG_IMAGES_BUCKET}/${key}`;
}

/**
 * Upload one article BODY image. Returns { ok, path, width, height }.
 *
 * Always downscales and re-encodes first, so the bucket's 5 MB limit is
 * effectively never hit and an SVG can never land in a public bucket. The size
 * check is therefore against the OUTPUT, not the file the author picked.
 *
 * Returns the PATH only, deliberately: body_md stores paths, and handing back a
 * URL would invite one being pasted into a body. The dimensions are baked into
 * the filename so lib/markdown.js can read them back and the renderer can
 * reserve the box before the bytes arrive.
 */
export async function uploadArticleBodyImage(supabase, userId, file) {
  if (!file) return { ok: false, error: "No file selected." };
  if (!file.type?.startsWith("image/")) {
    return { ok: false, error: "Please choose an image file." };
  }

  const out = await downscaleImage(file);
  if (!out) return { ok: false, error: "Could not read that image." };
  if (out.blob.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }

  // Derive the extension from what the canvas ACTUALLY produced: toBlob falls
  // back to PNG where WebP encoding is unsupported, and a .webp name holding
  // PNG bytes is a lie the CDN would serve for a year (see cacheControl below).
  const ext = out.blob.type === "image/webp" ? "webp" : "png";
  // The random segment closes a Date.now() collision that upsert:true would
  // otherwise turn into a silent overwrite across two tabs. It sits BEFORE the
  // dimensions, which the extension-anchored regex in lib/markdown.js handles.
  const rand = Math.random().toString(36).slice(2, 6);
  const path = `${userId}/body-${Date.now()}-${rand}-${out.width}x${out.height}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BLOG_IMAGES_BUCKET)
    .upload(path, out.blob, {
      upsert: true,
      contentType: out.blob.type,
      cacheControl: "31536000",
    });
  if (uploadErr) return { ok: false, error: uploadErr.message || "Upload failed." };

  return { ok: true, path, width: out.width, height: out.height };
}

/**
 * Best-effort removal of blog-images objects, used by the article delete sweep.
 * Never throws: a failure here costs storage, not correctness. The bucket's
 * owner-scoped DELETE policy is the backstop, so a path in another author's
 * folder silently no-ops rather than deleting their file.
 */
export async function removeBlogImages(supabase, paths) {
  const keys = [...new Set((paths || []).filter(Boolean))];
  if (!keys.length) return { ok: true, removed: 0 };
  const { error } = await supabase.storage.from(BLOG_IMAGES_BUCKET).remove(keys);
  if (error) {
    console.warn("[removeBlogImages]", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, removed: keys.length };
}

// ============================================================================
// Tutor documentation (PDF + image).
// ----------------------------------------------------------------------------
// Public documents shown on the profile's "Documentation" card. Files live in
// the PUBLIC bucket `tutor-docs` (same per-user folder layout as profile
// images); the `tutor_documents` table (both from migration 0034) is the
// source of truth the app reads — one row per file with the tutor-chosen
// title. Uploads insert both; reads never list the bucket. There is no UPDATE
// policy on the bucket, so uploads must not use upsert — paths are
// timestamped and therefore unique anyway.
// ============================================================================

export const TUTOR_DOCS_BUCKET = "tutor-docs";

export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB — mirrored by the bucket's file_size_limit
export const MAX_TUTOR_DOCS = 5; // client-side cap; size/MIME are what the bucket enforces

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

/** Public download URL for a stored doc — pure string building, no network. */
function tutorDocUrl(supabase, path) {
  const { data } = supabase.storage.from(TUTOR_DOCS_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/**
 * Upload one document with its display title (blank -> cleaned filename).
 * Uploads the file, then inserts the `tutor_documents` row; if the row insert
 * fails the file is removed again so nothing invisible is left behind.
 * Resolves to { ok, id, title, path, url } or { ok: false, error }. Never
 * throws.
 */
export async function uploadTutorDoc(supabase, userId, file, title) {
  if (!file) return { ok: false, error: "No file selected." };
  if (!isAllowedDocType(file.type)) {
    return { ok: false, error: "Only PDF or image files are accepted." };
  }
  if (file.size > MAX_DOC_BYTES) {
    return { ok: false, error: "Files must be 10 MB or smaller." };
  }

  const name = `${Date.now()}-${safeDocName(file.name)}`;
  const path = `${userId}/${name}`;

  const { error: uploadErr } = await supabase.storage
    .from(TUTOR_DOCS_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (uploadErr) return { ok: false, error: uploadErr.message || "Upload failed." };

  const cleanTitle = String(title || "").trim() || docDisplayName(name);
  const { data: row, error: rowErr } = await supabase
    .from("tutor_documents")
    .insert({ tutor_id: userId, storage_path: path, title: cleanTitle })
    .select("id")
    .single();
  if (rowErr || !row) {
    // The row is what makes the file visible — without it, take the file back.
    await supabase.storage.from(TUTOR_DOCS_BUCKET).remove([path]);
    return { ok: false, error: rowErr?.message || "Upload failed." };
  }

  return { ok: true, id: row.id, title: cleanTitle, path, url: tutorDocUrl(supabase, path) };
}

/**
 * List a tutor's documents from `tutor_documents` (public-read, so this works
 * for any visitor — the profile page calls it with the anon server client).
 * Resolves to [{ id, title, path, url }], oldest upload first.
 */
export async function listTutorDocs(supabase, tutorId) {
  const { data, error } = await supabase
    .from("tutor_documents")
    .select("id, storage_path, title")
    .eq("tutor_id", tutorId)
    .order("uploaded_at", { ascending: true });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    path: row.storage_path,
    url: tutorDocUrl(supabase, row.storage_path),
  }));
}

/**
 * Retitle one of the caller's documents (RLS scopes the update to the owner;
 * an empty result means the row wasn't theirs). Resolves to { ok, title } or
 * { ok: false, error }.
 */
export async function updateTutorDocTitle(supabase, id, title) {
  const clean = String(title || "").trim();
  if (!clean) return { ok: false, error: "Title can't be empty." };
  const { data, error } = await supabase
    .from("tutor_documents")
    .update({ title: clean })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: error.message || "Could not rename the document." };
  if (!Array.isArray(data) || data.length === 0) return { ok: false, error: "Could not rename the document." };
  return { ok: true, title: clean };
}

/**
 * Delete one of the caller's documents: the row first (it's the source of
 * truth — an orphaned file is invisible, an orphaned row is a broken link),
 * then best-effort file removal. An empty delete result means RLS blocked it.
 */
export async function deleteTutorDoc(supabase, id, path) {
  const { data, error } = await supabase.from("tutor_documents").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: error.message || "Could not remove the document." };
  if (!Array.isArray(data) || data.length === 0) return { ok: false, error: "Could not remove the document." };
  await supabase.storage.from(TUTOR_DOCS_BUCKET).remove([path]);
  return { ok: true };
}
