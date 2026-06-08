// ============================================================================
// sync-tutors-audience.mjs — push current tutors into a Resend Audience.
// ----------------------------------------------------------------------------
// Run:  npm run sync:audience
//
// Reconciles the Resend Audience (used for Broadcasts) with the live tutor list:
//   * pulls every tutor (profiles.role = 'tutor') + their CONFIRMED email
//     (service-role Supabase client — bypasses RLS, reads auth.users emails)
//   * creates a Resend contact for each tutor not already in the audience
//
// Idempotent. It only CREATES missing contacts — it never PATCHes existing ones,
// so anyone who unsubscribed in Resend stays unsubscribed (opt-outs preserved).
// Stale contacts (accounts since deleted) are logged, not removed (v1).
//
// SERVER-ONLY secrets — this is a local/admin script, never shipped to the
// browser. Needs RESEND_API_KEY, RESEND_AUDIENCE_ID, NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY (read from .env.local, parsed below).
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ── Load env files (no dependency; works on Node 18+) ───────────────────────
// A minimal KEY=VALUE parser: ignores blanks/comments, strips matching quotes.
// Does not expand variables — values are taken literally (matches dotenv basics).
// Reads .env.local then .env (first wins / already-set wins), matching Next's
// precedence, so it works whichever filename the secrets live in.
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

const {
  RESEND_AUDIENCE_ID,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

// Managing contacts/audiences needs a FULL-ACCESS Resend key — the app's
// RESEND_API_KEY is typically restricted to "sending only" and gets a 401 here.
// Prefer a dedicated RESEND_AUDIENCE_API_KEY (full access) if set, else fall
// back to RESEND_API_KEY (works only if that key has full access).
const RESEND_API_KEY = process.env.RESEND_AUDIENCE_API_KEY || process.env.RESEND_API_KEY;

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

// RESEND_AUDIENCE_ID is OPTIONAL — if unset we auto-detect it (Resend's newer
// dashboard gives one default audience and doesn't expose its id in the URL).
const missing = [
  ["RESEND_API_KEY", RESEND_API_KEY],
  ["NEXT_PUBLIC_SUPABASE_URL", NEXT_PUBLIC_SUPABASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
].filter(([, v]) => !v).map(([k]) => k);

if (missing.length) {
  die(`Missing required env var(s): ${missing.join(", ")}. Set them in .env.local.`);
}

// ── Resend helpers (same request shape as lib/email/send.js) ────────────────
const RESEND_BASE = "https://api.resend.com";

function resendHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${RESEND_API_KEY}`,
  };
}

// Resolve the audience id: use RESEND_AUDIENCE_ID if set, else auto-detect by
// listing audiences. With exactly one audience (the common case) we use it;
// with several we ask the user to pin one via RESEND_AUDIENCE_ID.
async function resolveAudienceId() {
  if (RESEND_AUDIENCE_ID) return RESEND_AUDIENCE_ID;
  const res = await fetch(`${RESEND_BASE}/audiences`, { headers: resendHeaders() });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 401) {
      die(
        `Resend returned 401 (${detail}).\n` +
          `  Your key can only send emails — managing contacts needs FULL ACCESS.\n` +
          `  Resend → API Keys → Create API Key → Permission: "Full access", then set\n` +
          `  RESEND_AUDIENCE_API_KEY=<that key> in .env (leave RESEND_API_KEY as-is).`,
      );
    }
    die(`Could not list audiences (${res.status}): ${detail}`);
  }
  const json = await res.json();
  const list = json?.data ?? [];
  if (list.length === 0) {
    die("No Resend audience found. Create one in Resend → Audience, then re-run.");
  }
  if (list.length > 1) {
    const lines = list.map((a) => `    ${a.id}  ${a.name ?? ""}`).join("\n");
    die(
      `Found ${list.length} audiences — set RESEND_AUDIENCE_ID in .env.local to one of:\n${lines}`,
    );
  }
  console.log(`Auto-detected audience: ${list[0].name ?? "(unnamed)"} [${list[0].id}]`);
  return list[0].id;
}

// List every contact already in the audience (paginate defensively).
async function fetchExistingContactEmails(audienceId) {
  const emails = new Set();
  // Resend's contacts list isn't reliably cursor-paginated across versions; it
  // returns the audience's contacts in one `data` array. We read it once and,
  // if a cursor surfaces, follow it.
  let url = `${RESEND_BASE}/audiences/${audienceId}/contacts`;
  for (let guard = 0; guard < 50; guard++) {
    const res = await fetch(url, { headers: resendHeaders() });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      die(`Could not list audience contacts (${res.status}): ${detail}`);
    }
    const json = await res.json();
    const rows = json?.data ?? [];
    for (const c of rows) if (c?.email) emails.add(c.email.toLowerCase());
    // No standard "next" cursor in the contacts response today; stop after one
    // page unless Resend later adds one.
    const next = json?.next || json?.pagination?.next;
    if (!next) break;
    url = `${RESEND_BASE}/audiences/${audienceId}/contacts?after=${encodeURIComponent(next)}`;
  }
  return emails;
}

async function createContact(audienceId, { email, firstName, lastName }) {
  const res = await fetch(`${RESEND_BASE}/audiences/${audienceId}/contacts`, {
    method: "POST",
    headers: resendHeaders(),
    body: JSON.stringify({
      email,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      unsubscribed: false,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.warn(`  ! failed to add ${email} (${res.status}): ${detail}`);
    return false;
  }
  return true;
}

function splitName(fullName) {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const audienceId = await resolveAudienceId();

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Tutors (id + authoritative display name from profiles).
  const { data: tutorRows, error: tutorErr } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "tutor");
  if (tutorErr) die(`Failed to read tutor profiles: ${tutorErr.message}`);

  const nameById = new Map((tutorRows ?? []).map((r) => [r.id, r.full_name ?? ""]));
  const tutorIds = new Set(nameById.keys());
  console.log(`Found ${tutorIds.size} tutor profile(s).`);

  // 2. Emails from auth.users (paginate listUsers).
  const emailById = new Map(); // id -> { email, confirmed }
  for (let page = 1; page <= 1000; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) die(`Failed to list users: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) {
      emailById.set(u.id, {
        email: u.email ?? null,
        confirmed: !!u.email_confirmed_at,
      });
    }
    if (users.length < 1000) break;
  }

  // 3. Desired recipients: tutors with a confirmed email.
  const desired = []; // { email, firstName, lastName }
  let skippedUnconfirmed = 0;
  let skippedNoEmail = 0;
  for (const id of tutorIds) {
    const rec = emailById.get(id);
    if (!rec || !rec.email) {
      skippedNoEmail++;
      continue;
    }
    if (!rec.confirmed) {
      skippedUnconfirmed++;
      continue;
    }
    const { firstName, lastName } = splitName(nameById.get(id));
    desired.push({ email: rec.email, firstName, lastName });
  }

  // 4. Existing audience contacts (preserve opt-outs: only add missing ones).
  const existing = await fetchExistingContactEmails(audienceId);

  // 5. Create the missing ones.
  let added = 0;
  let alreadyPresent = 0;
  for (const d of desired) {
    if (existing.has(d.email.toLowerCase())) {
      alreadyPresent++;
      continue;
    }
    const ok = await createContact(audienceId, d);
    if (ok) {
      added++;
      console.log(`  + ${d.email}`);
    }
  }

  // 6. Stale contacts: in the audience but no longer a confirmed tutor (log only).
  const desiredEmails = new Set(desired.map((d) => d.email.toLowerCase()));
  const stale = [...existing].filter((e) => !desiredEmails.has(e));

  console.log("\n── Sync summary ─────────────────────────────");
  console.log(`  added:                ${added}`);
  console.log(`  already present:      ${alreadyPresent}`);
  console.log(`  skipped (unconfirmed):${skippedUnconfirmed}`);
  console.log(`  skipped (no email):   ${skippedNoEmail}`);
  console.log(`  audience total now:   ${existing.size + added}`);
  if (stale.length) {
    console.log(
      `\n  note: ${stale.length} contact(s) in the audience are no longer confirmed tutors\n` +
        `        (not removed — prune manually in Resend if desired):`,
    );
    for (const e of stale) console.log(`    - ${e}`);
  }
  console.log("─────────────────────────────────────────────\n");
}

main().catch((err) => die(err?.stack || String(err)));
