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
--   approve-link flow (app/api/verification/*). It sets the same columns the
--   approve route sets, so the result is identical to a real approval:
--     * tutor_profiles.verified            = true   (renders the VerifiedTick
--                                                     and applies the ranking
--                                                     boost — see lib/ranking.js)
--     * tutor_profiles.verification_status = 'verified'
--   It does NOT insert a /notifications row or send the "you're verified" email
--   (those are side effects of the approve route, not of the DB state). Requires
--   migration 0021 to be applied.
--
-- To UN-verify instead, set verified=false and verification_status='none' on the
-- same row (uncomment the second statement).
-- ============================================================================

begin;

-- >>> EDIT THIS LINE — paste the tutor_profiles.id (uuid) to verify <<<
select set_config('util.user_id', '00000000-0000-0000-0000-000000000000', false);

update public.tutor_profiles
   set verified = true,
       verification_status = 'verified'
 where id = current_setting('util.user_id')::uuid;

-- Un-verify (uncomment to use instead of the update above):
-- update public.tutor_profiles
--    set verified = false,
--        verification_status = 'none',
--        verification_requested_at = null
--  where id = current_setting('util.user_id')::uuid;

commit;

-- Sanity check — confirm the new state for that id.
select id, verified, verification_status, verification_requested_at
from public.tutor_profiles
where id = current_setting('util.user_id')::uuid;
