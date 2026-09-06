// ============================================================================
// Seed the blog into Supabase.
// ----------------------------------------------------------------------------
// Run:
//   node scripts/seed-blog-articles.mjs                  # dry run, writes nothing
//   node scripts/seed-blog-articles.mjs --apply          # actually seed
//   node scripts/seed-blog-articles.mjs --apply --force-covers
//
// WHAT THIS DOES
//   1. Resolves each byline name to a real tutor by slug, and REFUSES to write
//      anything if one is missing. An article with no author is worse than no
//      article, so this fails loudly rather than seeding a null byline.
//   2. Downloads each article's cover photo and uploads it to the blog-images
//      bucket under <author_uid>/, which is the folder the bucket's owner
//      policy (0061) allows that author to write to.
//   3. Upserts the articles on `slug`, so re-running is safe and never
//      duplicates. Covers are skipped when a row already has one, unless
//      --force-covers is passed.
//
// SERVER-ONLY secrets: this uses the service role key and is never shipped to
// the browser. It bypasses RLS by design, which is how it can insert rows
// already in the 'published' state that the client policies would reject.
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { SEED_ARTICLES, AUTHOR_SLUG_BY_NAME, COVER_URL_BY_SLUG } from "./blog-seed/index.mjs";

// Same minimal parser as sync-tutors-audience.mjs — the project has no dotenv.
function loadEnvFiles() {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const name of [".env.local", ".env"]) {
    let raw;
    try {
      raw = readFileSync(resolve(here, "..", name), "utf8");
    } catch {
      continue; // file absent — try the next candidate
    }
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

loadEnvFiles();

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", NEXT_PUBLIC_SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
]
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length) {
  die(`Missing required env var(s): ${missing.join(", ")}. Set them in .env.local.`);
}

const APPLY = process.argv.includes("--apply");
const FORCE_COVERS = process.argv.includes("--force-covers");

const BUCKET = "blog-images";

// Matches the bucket's allowed_mime_types and file_size_limit (0061) so a bad
// download fails here with a readable message instead of a storage 400.
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Byline name -> tutor uuid. Throws unless every author resolves. */
async function resolveAuthors() {
  const entries = Object.entries(AUTHOR_SLUG_BY_NAME);
  const bySlug = new Map();

  const { data, error } = await supabase
    .from("tutor_profiles")
    .select("id, slug")
    .in(
      "slug",
      entries.map(([, slug]) => slug),
    );

  if (error) die(`Could not read tutor_profiles: ${error.message}`);
  for (const row of data ?? []) bySlug.set(row.slug, row.id);

  const unresolved = entries.filter(([, slug]) => !bySlug.has(slug));
  if (unresolved.length) {
    die(
      `No tutor found for: ${unresolved.map(([name, slug]) => `"${name}" (slug ${slug})`).join(", ")}.\n` +
        `  These accounts must exist before the blog can be seeded. Either create them,\n` +
        `  or point AUTHOR_SLUG_BY_NAME in scripts/blog-seed/index.mjs at tutors that do exist.`,
    );
  }

  return new Map(entries.map(([name, slug]) => [name, bySlug.get(slug)]));
}

/** Download a cover and put it in the author's folder. Returns the path. */
async function uploadCover(slug, authorId) {
  const url = COVER_URL_BY_SLUG[slug];
  if (!url) die(`No cover URL configured for "${slug}" in scripts/blog-seed/index.mjs.`);

  const res = await fetch(url);
  if (!res.ok) die(`Cover download failed for "${slug}": ${res.status} ${res.statusText} (${url})`);

  const contentType = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  const ext = EXT_BY_TYPE[contentType];
  if (!ext) die(`Cover for "${slug}" is ${contentType}, which the bucket does not accept.`);

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_COVER_BYTES) {
    die(`Cover for "${slug}" is ${(bytes.length / 1048576).toFixed(1)} MB, over the 5 MB limit.`);
  }

  // Timestamped like every other upload in this repo. Supabase serves objects
  // no-cache unless told otherwise, and that cost real egress once, so the long
  // cacheControl is deliberate — see lib/supabase/storage.js.
  const path = `${authorId}/${slug}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, cacheControl: "31536000", upsert: false });

  if (error) die(`Cover upload failed for "${slug}": ${error.message}`);
  return path;
}

async function main() {
  console.log(APPLY ? "Seeding blog articles.\n" : "DRY RUN — nothing will be written.\n");

  const authorIdByName = await resolveAuthors();
  for (const [name, id] of authorIdByName) console.log(`  author  ${name} -> ${id}`);
  console.log("");

  const { data: existingRows, error: existingErr } = await supabase
    .from("articles")
    .select("slug, cover_path");
  if (existingErr) die(`Could not read articles: ${existingErr.message}`);
  const existingBySlug = new Map((existingRows ?? []).map((r) => [r.slug, r]));

  let inserted = 0;
  let updated = 0;

  for (const article of SEED_ARTICLES) {
    const { meta, bodyMd } = article;
    const authorId = authorIdByName.get(meta.authorName);
    if (!authorId) die(`Article "${meta.slug}" names an author that did not resolve.`);

    const existing = existingBySlug.get(meta.slug);
    const keepCover = existing?.cover_path && !FORCE_COVERS;

    let coverPath = existing?.cover_path ?? null;
    let coverNote = keepCover ? "cover kept" : "cover downloaded";

    if (!APPLY) {
      if (!keepCover) coverNote = `cover would come from ${COVER_URL_BY_SLUG[meta.slug]}`;
      const sections = (bodyMd.match(/^## /gm) || []).length;
      console.log(
        `  ${existing ? "update" : "insert"}  ${meta.slug}  (${sections} sections, ${coverNote})`,
      );
      existing ? updated++ : inserted++;
      continue;
    }

    if (!keepCover) {
      const newPath = await uploadCover(meta.slug, authorId);
      // Only drop the superseded object once the new one is safely up.
      if (existing?.cover_path) {
        await supabase.storage.from(BUCKET).remove([existing.cover_path]);
      }
      coverPath = newPath;
    }

    const row = {
      slug: meta.slug,
      title: meta.title,
      excerpt: meta.excerpt ?? null,
      category: meta.category ?? null,
      body_md: bodyMd,
      status: meta.status ?? "published",
      author_id: authorId,
      cover_path: coverPath,
      cover_alt: meta.coverAlt ?? null,
      published_at: meta.publishedAt ?? null,
      content_updated_at: meta.contentUpdatedAt ?? null,
    };

    const { error } = await supabase.from("articles").upsert(row, { onConflict: "slug" });
    if (error) die(`Upsert failed for "${meta.slug}": ${error.message}`);

    console.log(`  ${existing ? "update" : "insert"}  ${meta.slug}  (${coverNote})`);
    existing ? updated++ : inserted++;
  }

  console.log(
    `\n${APPLY ? "Done" : "Would apply"}: ${inserted} inserted, ${updated} updated.` +
      (APPLY ? "" : "\nRe-run with --apply to write.\n"),
  );
}

main().catch((err) => die(err?.stack || String(err)));
