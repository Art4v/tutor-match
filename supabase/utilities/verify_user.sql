-- ============================================================================
-- tutormatch — VERIFY ONE TUTOR BY ID (dev / admin shortcut)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Put the target tutor's uuid in the set_config(...) line below (one spot).
--   2. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--
-- Don't know the id? Look it up by email first (run this on its own):
--   select id, email from auth.users where email = 'someone@example.com';
--
-- WHAT IT DOES:
--   Flips the tutor to verified WITHOUT going through the request -> email ->
--   approve-link flow (app/api/verification/*). It reproduces the DB-visible
--   result of a real approval:
--     * tutor_profiles.verification_status = 'verified'   (the single source of
--                                                     truth since 0028 — the app
--                                                     derives `verified` from it.
--                                                     Renders the VerifiedTick,
--                                                     applies the ranking boost
--                                                     (lib/ranking.js), and
--                                                     matches the /browse
--                                                     Verified-only filter).
--   That's the whole approval since 0034: documents are public profile content
--   (`tutor_documents` + the `tutor-docs` bucket) and are NOT part of the
--   verification flow — a decision must not touch them.
--   It does NOT insert a /notifications row or send the "you're verified" email
--   (those are side effects of the approve route, not of the DB state).
--
--   NOTE (0052): verification and account status are independent. A tutor whose
--   profiles.status = 'disabled' stays hidden from every public read even when
--   verified — re-enable them with enable_user.sql if that's the intent. The
--   sanity check below shows both.
--
--   Requires migrations 0021 + 0028 + 0052.
--
-- To UN-verify instead, set verification_status='none' on the same row
-- (uncomment the block at the bottom). Use 'rejected' instead of 'none' to
-- reproduce a real rejection (/api/verification/reject) — the tutor can then
-- resubmit via request_tutor_verification (rejected -> pending).
-- ============================================================================

begin;

-- >>> EDIT THIS LINE — paste the tutor_profiles.id (uuid) to verify <<<
select set_config('util.user_id', '00000000-0000-0000-0000-000000000000', false);

update public.tutor_profiles
   set verification_status = 'verified'
 where id = current_setting('util.user_id')::uuid;

-- Un-verify (uncomment to use instead of the update above; swap 'none' for
-- 'rejected' to simulate a real rejection):
-- update public.tutor_profiles
--    set verification_status = 'none',
--        verification_requested_at = null
--  where id = current_setting('util.user_id')::uuid;

commit;

-- Sanity check — confirm the new state (status: a 'disabled' account stays
-- publicly hidden regardless of verification — see 0052).
select t.id,
       t.verification_status,
       t.verification_requested_at,
       p.status
from public.tutor_profiles t
join public.profiles p on p.id = t.id
where t.id = current_setting('util.user_id')::uuid;
