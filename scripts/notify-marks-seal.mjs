// ============================================================================
// One-off announcement after migration 0083 (the "marks verified" seal).
// ----------------------------------------------------------------------------
// Every tutor who was already verified starts WITHOUT the seal. This tells
// each of them once, in-app only, that the seal exists and how to ask for it.
//
//   node scripts/notify-marks-seal.mjs            (dry run, lists only)
//   node scripts/notify-marks-seal.mjs --apply    (writes the notifications)
//
// WHO: verified, not a tutoring centre's tutor, account enabled, and not
// already holding the seal (an admin may have granted some before this runs).
//
// NO EMAIL, by decision. That makes this the one deliberate exception to
// "every notification is emailed": it inserts into `notifications` directly
// with the service role instead of going through notifyUser().
//
// Safe to re-run: a tutor who already has a `marks_seal_intro` notification is
// skipped. Run it once, after the app that ships with 0083 is live (the
// notification points at a panel that only exists in that app).
//
// NEEDS: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local).
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const TYPE = "marks_seal_intro";
const TITLE = "New: the marks verified seal";
const BODY =
  "Tutors who prove their marks now get a marks verified seal beside their verified badge and rank at the top of search. " +
  "Open your profile, add your supporting documents under Get verified, and request it.";

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

const apply = process.argv.includes("--apply");
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE = 1000; // PostgREST's row cap

async function fetchAll(build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function main() {
  const tutors = await fetchAll(() =>
    supabase
      .from("tutor_profiles")
      .select("id, slug, marks_status, profile:profiles!inner ( full_name, status )")
      .eq("verification_status", "verified")
      .is("partner_id", null)
      .neq("marks_status", "verified")
      .eq("profile.status", "enabled")
      .order("id")
  );

  const already = new Set(
    (await fetchAll(() => supabase.from("notifications").select("user_id").eq("type", TYPE).order("user_id"))).map(
      (n) => n.user_id
    )
  );
  const todo = tutors.filter((t) => !already.has(t.id));

  console.log(`${tutors.length} verified tutors without the seal, ${tutors.length - todo.length} already told.`);
  for (const t of todo) {
    console.log(`  ${apply ? "notify" : "would notify"}  ${t.profile?.full_name || "(no name)"}  /tutor/${t.slug}`);
  }

  if (!apply) {
    console.log(`\nDry run: nothing written. Re-run with --apply to notify ${todo.length} tutors.`);
    return;
  }

  for (let i = 0; i < todo.length; i += 200) {
    const batch = todo.slice(i, i + 200).map((t) => ({ user_id: t.id, type: TYPE, title: TITLE, body: BODY }));
    const { error } = await supabase.from("notifications").insert(batch);
    if (error) throw error;
  }
  console.log(`\nDone: ${todo.length} notifications written.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
