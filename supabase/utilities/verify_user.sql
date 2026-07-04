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
--     * tutor_profiles.verification_status = 'verified'   (renders the
--                                                     VerifiedTick and applies the
--                                                     ranking boost — the app
--                                                     derives `verified` from this;
--                                                     see lib/ranking.js). This is
--                                                     the single source of truth
--                                                     since 0028 (the `verified`
--                                                     bool was dropped).
--     * wipes the tutor's verification-docs/<id>/ folder  (the approve/reject
--                                                     routes delete the supporting
--                                                     docs once a decision is made;
--                                                     0033 — docs only live while a
--                                                     review is pending).
--   It does NOT insert a /notifications row or send the "you're verified" email
--   (those are side effects of the approve route, not of the DB state). Requires
--   migrations 0021 + 0028 + 0033 to be applied.
--
-- To UN-verify instead, set verification_status='none' on the same row (uncomment
-- the block at the bottom). Un-verifying does NOT restore deleted docs.
-- ============================================================================

begin;

-- >>> EDIT THIS LINE — paste the tutor_profiles.id (uuid) to verify <<<
select set_config('util.user_id', '00000000-0000-0000-0000-000000000000', false);

update public.tutor_profiles
   set verification_status = 'verified'
 where id = current_setting('util.user_id')::uuid;

-- Sweep the supporting documents, mirroring deleteAllVerificationDocs() in the
-- approve route (docs are only kept while a review is pending; 0033). Files live
-- at verification-docs/<user_id>/<...>, so match on the first path segment.
delete from storage.objects
 where bucket_id = 'verification-docs'
   and (storage.foldername(name))[1] = current_setting('util.user_id');

-- Un-verify (uncomment to use instead of the update above):
-- update public.tutor_profiles
--    set verification_status = 'none',
--        verification_requested_at = null
--  where id = current_setting('util.user_id')::uuid;

commit;

-- Sanity check — confirm the new state + that no docs remain for that id.
select p.id,
       p.verification_status,
       p.verification_requested_at,
       (select count(*)
          from storage.objects o
         where o.bucket_id = 'verification-docs'
           and (storage.foldername(o.name))[1] = current_setting('util.user_id')
       ) as remaining_docs
from public.tutor_profiles p
where p.id = current_setting('util.user_id')::uuid;
