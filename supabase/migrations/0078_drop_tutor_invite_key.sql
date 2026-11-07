- -- ============================================================================
-- tutormatch — 0078: drop the tutor invite key (part 2 of Quick join)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0077 (in order).
--
-- DEPLOY ORDER: 0077 -> app -> 0078. Run this ONLY after the app that uses
--   redeem_tutor_invite(p_user_id) (no key) is live: the previous app's /join
--   routes call tutor_invite_key_valid and the two-argument redeem, and the old
--   /admin/tutor-invites page reads the key, so dropping them earlier breaks
--   every invite signup and that page.
--
-- WHAT IT DOES:
--   Removes everything that existed only to hold, check or rotate the secret
--   invite key. Nothing else changes: managed tutors, their materials and
--   the admin RPCs for them are untouched.
--
--   The admin_actions CHECK keeps 'tutor_invite_rotated', because History rows
--   with that action still exist and the history outlives what it describes
--   (as 0074 decided). Nothing writes it any more.
-- ============================================================================

drop function if exists public.redeem_tutor_invite(uuid, text);
drop function if exists public.tutor_invite_key_valid(text);
drop function if exists public.admin_get_tutor_invite_key();
drop function if exists public.admin_rotate_tutor_invite_key();
drop table    if exists public.tutor_invite_key;
