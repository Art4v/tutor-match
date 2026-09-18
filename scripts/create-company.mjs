// ============================================================================
// Create a company (tutoring company) and print its claim link.
// ----------------------------------------------------------------------------
// Companies are INVITE ONLY: there is no signup path and no verification step.
// We create the row, the page goes live immediately, and the company claims it
// with the signed link this prints. Existence is the endorsement.
//
//   npm run create:company -- --name "Kumon Chatswood" \
//                             --website https://example.com \
//                             --suburb Chatswood --state NSW
//
// Dry run by default, like seed:blog. Add --apply to actually write.
// Re-print a link for an existing company without creating anything:
//   npm run create:company -- --link <company-uuid>
//
// WHY THIS IS A SCRIPT AND NOT A .sql UTILITY (unlike grant_author.sql):
//   The claim link carries an HMAC token signed with PARTNER_INVITE_SECRET.
//   Signing it in SQL would mean the token format lived in two places, and the
//   day they drift every outstanding invite silently stops working. This
//   imports lib/companyToken.js so there is exactly one definition of it.
//
// NEEDS: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//        PARTNER_INVITE_SECRET (read from .env.local, parsed below).
//        SITE_URL is optional and defaults to http://localhost:3000.
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

// Imported AFTER loadEnvFiles(): lib/companyToken.js reads the secret lazily
// inside secret(), so import order is not actually load-bearing, but keeping
// it here makes that independence obvious rather than accidental.
const { signCompanyInviteToken } = await import("../lib/companyToken.js");

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PARTNER_INVITE_SECRET } = process.env;
const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!PARTNER_INVITE_SECRET) {
  console.error("Missing PARTNER_INVITE_SECRET — invite links cannot be signed without it.");
  process.exit(1);
}

// ── Args ────────────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}
const APPLY = process.argv.includes("--apply");
const linkOnly = arg("link");

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const claimUrl = (id) => `${SITE_URL}/companies/claim?token=${encodeURIComponent(signCompanyInviteToken(id))}`;

// ── Re-print a link for an existing company ──────────────────────────────────
if (linkOnly) {
  const { data, error } = await supabase
    .from("partners")
    .select("id, name, slug, owner_id")
    .eq("id", linkOnly)
    .maybeSingle();
  if (error || !data) {
    console.error(`No company with id ${linkOnly}.`);
    process.exit(1);
  }
  if (data.owner_id) {
    console.error(`${data.name} has already been claimed. A fresh link would be inert.`);
    process.exit(1);
  }
  console.log(`\n${data.name}  (/companies/${data.slug})\n\n  ${claimUrl(data.id)}\n`);
  process.exit(0);
}

// ── Create ──────────────────────────────────────────────────────────────────
const name = arg("name");
if (!name) {
  console.error('Usage: npm run create:company -- --name "Company Name" [--website URL] [--suburb S] [--state NSW] [--apply]');
  process.exit(1);
}

const row = {
  name: name.trim(),
  website_url: arg("website"),
  suburb: arg("suburb"),
  // `city` stores the STATE CODE, matching tutor_profiles.city. The naming is
  // historical; see the /browse State filter in CLAUDE.md.
  city: arg("state"),
  // Placeholder slug (replaced immediately below by the race-safe assigner),
  // mirroring how choose_role seeds a tutor's slug with their uuid.
  slug: `pending-${Date.now()}`,
};

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply.\n");
  console.log(row);
  console.log("\nOn apply this company's page goes LIVE immediately, before anyone claims it.");
  console.log("Keep the pre-filled copy factual and sourced from the company's own site.\n");
  process.exit(0);
}

const { data: created, error: insertError } = await supabase
  .from("partners")
  .insert(row)
  .select("id")
  .single();

if (insertError) {
  console.error("Could not create the company:", insertError.message);
  process.exit(1);
}

// Race-safe slug from the real name (0063), same helper the rename RPC uses.
const { data: slug, error: slugError } = await supabase.rpc("_assign_partner_slug", {
  p_id: created.id,
  p_name: row.name,
});
if (slugError) {
  console.error(`Created ${created.id} but could not assign a slug:`, slugError.message);
  process.exit(1);
}

console.log(`\nCreated ${row.name}`);
console.log(`  page:  ${SITE_URL}/companies/${slug}   (live now)`);
console.log(`  claim: ${claimUrl(created.id)}`);
console.log("\nSend the claim link to the company. It stops working once used.\n");
