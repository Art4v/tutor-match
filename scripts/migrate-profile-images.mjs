// ============================================================================
// migrate-profile-images.mjs — one-off: shrink + cache-header existing images.
// ----------------------------------------------------------------------------
// Run:  npm i sharp --no-save          (sharp is not a project dependency)
//       node scripts/migrate-profile-images.mjs             (dry run — no writes)
//       node scripts/migrate-profile-images.mjs --apply     (do the migration)
//       node scripts/migrate-profile-images.mjs --apply --prune-orphans
//
// Context: images uploaded before the client-side downscaling fix
// (components/ImageCropModal.jsx) are stored at original resolution (up to
// ~2.8 MB) and — because uploads didn't pass cacheControl — are served with
// `Cache-Control: no-cache`, so every page view re-downloads them. Together
// those blew the Supabase free-plan cached-egress quota.
//
// For every avatar_url / banner_url on tutor_profiles that points into the
// `profile-images` bucket, this script:
//   1. downloads the object
//   2. downscales with sharp to the same caps as new uploads
//      (avatar ≤1024px, banner ≤2400px longest side), JPEG q85, EXIF-rotated,
//      flattened onto white (JPEG has no alpha)
//   3. uploads it under a new timestamped path with cacheControl 31536000
//      (new URL = old cached copies simply stop being referenced)
//   4. points the tutor_profiles column at the new URL
//   5. deletes the old object
//
// Objects whose stored cacheControl already starts with "max-age" were
// uploaded AFTER the app fix and are left untouched.
//
// Unreferenced bucket files (orphans from pre-fix re-uploads) are listed and,
// only with --prune-orphans, deleted.
//
// Idempotent: re-running skips already-migrated images. Dry run performs the
// download + resize (so the size savings shown are real) but writes nothing.
//
// SERVER-ONLY secrets — local/admin script, never shipped to the browser.
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env.local/.env).
// Safe to delete this file once the migration has run in production.
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ── Load env files (same minimal parser as sync-tutors-audience.mjs) ────────
function loadEnvFiles() {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const name of [".env.local", ".env"]) {
    let raw;
    try {
      raw = readFileSync(resolve(here, "..", name), "utf8");
    } catch {
      continue;
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

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  die("Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local.");
}

// sharp is deliberately not a dependency (matches scripts/gen-og-image.mjs).
let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  die("sharp is not installed. Run:  npm i sharp --no-save  and re-run this script.");
}

const APPLY = process.argv.includes("--apply");
const PRUNE_ORPHANS = process.argv.includes("--prune-orphans");

const BUCKET = "profile-images";
// Must match the caps in components/profile-edit/sections.js (maxOutputPx).
const MAX_PX = { avatar: 1024, banner: 2400 };
const JPEG_QUALITY = 85; // matches ImageCropModal's 0.85
const CACHE_CONTROL = "31536000"; // matches lib/supabase/storage.js

const PUBLIC_PREFIX = `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const fmtKB = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

// Extract the bucket-relative path from a stored public URL; null if the URL
// doesn't point into our bucket (external image, other project, etc.).
function pathFromUrl(url) {
  if (!url || !url.startsWith(PUBLIC_PREFIX)) return null;
  return decodeURIComponent(url.slice(PUBLIC_PREFIX.length).split("?")[0]);
}

// List every object in the bucket (one level of per-user folders, as written
// by lib/supabase/storage.js). Returns Map<path, { size, cacheControl }>.
async function listAllObjects() {
  const byPath = new Map();
  const { data: top, error } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
  if (error) die(`Could not list bucket: ${error.message}`);
  for (const entry of top ?? []) {
    if (entry.id !== null) {
      // stray file at the bucket root (shouldn't exist, but handle it)
      byPath.set(entry.name, {
        size: entry.metadata?.size ?? 0,
        cacheControl: entry.metadata?.cacheControl ?? "",
      });
      continue;
    }
    const { data: files, error: innerErr } = await supabase.storage
      .from(BUCKET)
      .list(entry.name, { limit: 1000 });
    if (innerErr) die(`Could not list folder ${entry.name}: ${innerErr.message}`);
    for (const f of files ?? []) {
      byPath.set(`${entry.name}/${f.name}`, {
        size: f.metadata?.size ?? 0,
        cacheControl: f.metadata?.cacheControl ?? "",
      });
    }
  }
  return byPath;
}

async function migrateOne({ tutorId, kind, column, oldPath, meta }) {
  const label = `${tutorId.slice(0, 8)}… ${kind}`;

  // Uploaded after the app fix — already small + cached; nothing to do.
  // Must match the exact year-long value: pre-fix uploads got Supabase's
  // default max-age=3600, which still needs migrating.
  if (meta?.cacheControl === `max-age=${CACHE_CONTROL}`) {
    console.log(`  = ${label}: already migrated (${fmtKB(meta.size)}), skipping`);
    return { skipped: true };
  }

  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(oldPath);
  if (dlErr) {
    console.warn(`  ! ${label}: download failed (${dlErr.message}) — DB left untouched`);
    return { failed: true };
  }
  const input = Buffer.from(await blob.arrayBuffer());

  let output;
  try {
    output = await sharp(input)
      .rotate() // bake in EXIF orientation before it's lost to re-encoding
      .resize({
        width: MAX_PX[kind],
        height: MAX_PX[kind],
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
  } catch (err) {
    console.warn(`  ! ${label}: sharp failed (${err.message}) — DB left untouched`);
    return { failed: true };
  }

  console.log(
    `  → ${label}: ${fmtKB(input.length)} → ${fmtKB(output.length)}` + (APPLY ? "" : " (dry run)"),
  );
  if (!APPLY) return { migrated: true, saved: input.length - output.length };

  const newPath = `${tutorId}/${kind}-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, output, {
    contentType: "image/jpeg",
    cacheControl: CACHE_CONTROL,
    upsert: false,
  });
  if (upErr) {
    console.warn(`  ! ${label}: upload failed (${upErr.message}) — DB left untouched`);
    return { failed: true };
  }

  const newUrl = supabase.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
  const { error: dbErr } = await supabase
    .from("tutor_profiles")
    .update({ [column]: newUrl })
    .eq("id", tutorId);
  if (dbErr) {
    // Roll back the new object so a re-run starts clean; the old URL still works.
    await supabase.storage.from(BUCKET).remove([newPath]);
    console.warn(`  ! ${label}: DB update failed (${dbErr.message}) — rolled back`);
    return { failed: true };
  }

  // Old object last — everything now points at the new one, so this is safe.
  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([oldPath]);
  if (rmErr) console.warn(`  ! ${label}: could not delete old object ${oldPath} (${rmErr.message})`);

  return { migrated: true, saved: input.length - output.length };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(APPLY ? "APPLY mode — bucket and DB will be modified.\n" : "Dry run — no writes. Pass --apply to migrate.\n");

  const { data: tutors, error } = await supabase
    .from("tutor_profiles")
    .select("id, avatar_url, banner_url");
  if (error) die(`Failed to read tutor_profiles: ${error.message}`);

  const objects = await listAllObjects();
  console.log(`Found ${tutors.length} tutor row(s), ${objects.size} object(s) in ${BUCKET}.\n`);

  // Referenced images → migrate.
  const jobs = [];
  for (const t of tutors) {
    for (const [column, kind] of [["avatar_url", "avatar"], ["banner_url", "banner"]]) {
      const oldPath = pathFromUrl(t[column]);
      if (!oldPath) continue;
      if (!objects.has(oldPath)) {
        console.warn(`  ! ${t.id.slice(0, 8)}… ${kind}: ${column} points at missing object ${oldPath}`);
        continue;
      }
      jobs.push({ tutorId: t.id, kind, column, oldPath, meta: objects.get(oldPath) });
    }
  }

  let migrated = 0, skipped = 0, failed = 0, savedBytes = 0;
  for (const job of jobs) {
    const res = await migrateOne(job);
    if (res.migrated) { migrated++; savedBytes += res.saved ?? 0; }
    else if (res.skipped) skipped++;
    else failed++;
  }

  // Orphans: in the bucket but referenced by no tutor row (old replaced
  // uploads). Reported always; deleted only with --prune-orphans.
  const referenced = new Set(jobs.map((j) => j.oldPath));
  const orphans = [...objects.keys()].filter((p) => !referenced.has(p));
  let orphanBytes = 0;
  for (const p of orphans) orphanBytes += objects.get(p).size;

  if (orphans.length) {
    console.log(`\n${orphans.length} orphaned object(s) (${fmtKB(orphanBytes)}) referenced by no profile:`);
    for (const p of orphans) console.log(`    - ${p}`);
    if (APPLY && PRUNE_ORPHANS) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(orphans);
      if (rmErr) console.warn(`  ! orphan prune failed: ${rmErr.message}`);
      else console.log("  orphans deleted.");
    } else {
      console.log("  (left in place — pass --apply --prune-orphans to delete)");
    }
  }

  console.log("\n── Migration summary ────────────────────────");
  console.log(`  mode:        ${APPLY ? "APPLY" : "dry run"}`);
  console.log(`  migrated:    ${migrated}  (saved ${(savedBytes / 1048576).toFixed(1)} MB)`);
  console.log(`  skipped:     ${skipped}  (already migrated)`);
  console.log(`  failed:      ${failed}`);
  console.log(`  orphans:     ${orphans.length}  (${(orphanBytes / 1048576).toFixed(1)} MB${APPLY && PRUNE_ORPHANS ? ", deleted" : ", kept"})`);
  console.log("─────────────────────────────────────────────\n");

  if (failed) process.exitCode = 1;
}

main().catch((err) => die(err?.stack || String(err)));
