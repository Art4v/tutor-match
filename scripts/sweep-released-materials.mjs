// ============================================================================
// One-off clean-up after migration 0081 (managed setup flow).
// ----------------------------------------------------------------------------
// 0081 released the tutors managed under 0076 who were verified AND marked set
// up, and moved the rest into the new setup flow. SQL cannot delete Storage files
// (storage.protect_delete), so two kinds of private file were left behind:
//
//   1. Signup materials of the released tutors: their tutor_invite_materials
//      rows and every file in their folder of the private
//      `tutor-invite-materials` bucket. A tutor who is still managed keeps
//      theirs, since the admins still need them.
//   2. Staged draft files: 0081 withdrew the open draft of each tutor it kept
//      managed (a managed tutor no longer has drafts, and is not verified). Whatever
//      sits in their folder of `profile-staging` is an orphan. A verified
//      tutor's folder is NOT touched: their draft is live.
//
//   node scripts/sweep-released-materials.mjs            (dry run, lists only)
//   node scripts/sweep-released-materials.mjs --apply    (deletes)
//
// Safe to re-run: materials are only removed for tutors whose managed_at is
// NULL, so a tutor in the setup flow keeps theirs, and a second run finds
// nothing. Run it once, after 0081.
//
// NEEDS: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local).
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ── Load env files (no dependency; works on Node 18+) ───────────────────────
// Lifted verbatim from scripts/sync-tutors-audience.mjs.
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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

loadEnvFiles();

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const MATERIALS_BUCKET = "tutor-invite-materials";
const STAGING_BUCKET = "profile-staging";

const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(what, error) {
  console.error(`${what}:`, error?.message || error);
  process.exit(1);
}

/** Every file path directly inside `<folder>/` of a bucket. */
async function listFolder(bucket, folder) {
  const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
  if (error) fail(`Could not list ${bucket}/${folder}`, error);
  // Folder placeholders come back with a null id; files have one.
  return (data ?? []).filter((f) => f?.id && f.name).map((f) => `${folder}/${f.name}`);
}

async function removeFiles(bucket, paths) {
  if (!paths.length || !APPLY) return;
  const { error } = await admin.storage.from(bucket).remove(paths);
  if (error) fail(`Could not remove files from ${bucket}`, error);
}

/**
 * Of `ids`, id -> verification status. Managed tutors are left out unless
 * `includeManaged`.
 */
async function tutorStatuses(ids, { includeManaged = false } = {}) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin
      .from("tutor_profiles")
      .select("id, verification_status, managed_at")
      .in("id", ids.slice(i, i + 200));
    if (error) fail("Could not read tutor_profiles", error);
    for (const t of data ?? []) if (includeManaged || !t.managed_at) out.set(t.id, t.verification_status);
  }
  return out;
}

// ── 1. Signup materials of tutors who are no longer managed ─────────────────
const { data: materialRows, error: materialsErr } = await admin.from("tutor_invite_materials").select("tutor_id");
if (materialsErr) fail("Could not read tutor_invite_materials", materialsErr);
const materialTutors = [...new Set((materialRows ?? []).map((r) => r.tutor_id))];
const releasedWithMaterials = [...(await tutorStatuses(materialTutors)).keys()];

let materialFiles = 0;
for (const id of releasedWithMaterials) {
  const paths = await listFolder(MATERIALS_BUCKET, id);
  materialFiles += paths.length;
  console.log(`materials  ${id}  ${paths.length} file(s)`);
  await removeFiles(MATERIALS_BUCKET, paths);
  if (APPLY) {
    const { error } = await admin.from("tutor_invite_materials").delete().eq("tutor_id", id);
    if (error) fail(`Could not delete materials rows for ${id}`, error);
  }
}

// ── 2. Staged draft files of unverified tutors whose draft was withdrawn ────
// A withdrawn revision is the trace 0081 left. Managed tutors are included: a
// managed tutor has no drafts any more, so nothing in their staging folder is
// in use. Skip anyone verified (their staging folder belongs to a draft they
// can still open) and anyone with an open revision.
const { data: withdrawn, error: withdrawnErr } = await admin
  .from("tutor_profile_revisions")
  .select("tutor_id")
  .eq("status", "withdrawn");
if (withdrawnErr) fail("Could not read tutor_profile_revisions", withdrawnErr);
const { data: open, error: openErr } = await admin
  .from("tutor_profile_revisions")
  .select("tutor_id")
  .in("status", ["draft", "pending"]);
if (openErr) fail("Could not read tutor_profile_revisions", openErr);
const hasOpen = new Set((open ?? []).map((r) => r.tutor_id));

const candidates = [...new Set((withdrawn ?? []).map((r) => r.tutor_id))].filter((id) => !hasOpen.has(id));
const statuses = await tutorStatuses(candidates, { includeManaged: true });

let stagedFiles = 0;
let stagedTutors = 0;
for (const [id, status] of statuses) {
  if (status === "verified") continue;
  const paths = await listFolder(STAGING_BUCKET, id);
  if (!paths.length) continue;
  stagedTutors += 1;
  stagedFiles += paths.length;
  console.log(`staging    ${id}  ${paths.length} file(s)`);
  await removeFiles(STAGING_BUCKET, paths);
}

console.log("");
console.log(
  `${APPLY ? "Removed" : "Would remove"} ${materialFiles} signup file(s) and the materials rows of ${releasedWithMaterials.length} tutor(s), ` +
    `and ${stagedFiles} staged file(s) of ${stagedTutors} tutor(s).`
);
if (!APPLY) console.log("Dry run. Re-run with --apply to delete.");
