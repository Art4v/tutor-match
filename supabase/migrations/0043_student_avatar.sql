-- ============================================================================
-- tutormatch — slice 43: student profile photo
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0042 (in order).
--
-- WHY:
--   Student accounts (v1) had no profile photo — only tutors did (avatar_url on
--   tutor_profiles, 0006). student_profiles was just id + created_at, so there
--   was nowhere to store a student's avatar. This adds that column so students
--   can set a profile photo on /account and have it show in the top-nav chip.
--
-- WHAT THIS DOES:
--   Adds student_profiles.avatar_url (text, nullable). No RLS change: the
--   existing "student self rw" FOR ALL policy (using/with check auth.uid()=id,
--   from 0001) already lets a student self-write this column from the client.
--   The image itself lives in the existing public `profile-images` bucket
--   (0006), whose owner-by-uid-folder policies already admit any authenticated
--   user, so no storage change is needed either.
-- ============================================================================

alter table public.student_profiles
  add column if not exists avatar_url text;
