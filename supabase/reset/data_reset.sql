-- ============================================================================
-- tutormatch — DATA RESET (dev only)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- WARNING — this is destructive. It deletes:
--   * every row in `auth.users` (every signed-up account)
--   * every row in `public.profiles`, `public.tutor_profiles`,
--     `public.student_profiles`, and all four tutor child tables
--     (`tutor_subjects`, `tutor_packages`, `tutor_experience`,
--     `tutor_education`) — drained via `on delete cascade`.
--
-- WHAT IT PRESERVES (intentionally):
--   * The schema itself: tables, columns, indexes, constraints.
--   * RLS policies and the `handle_new_user()` / `generate_unique_slug()`
--     functions and their triggers.
--   * The seeded `public.subjects` reference table (the 17 HSC/UCAT/LSAT
--     subjects from 0002_tutor_profile.sql).
--
-- Use this when iterating in dev and you want a fresh slate without having to
-- re-run every migration.
-- ============================================================================

begin;

-- Cascading FK chain:
--   auth.users(id)
--     -> public.profiles(id)            on delete cascade
--        -> public.tutor_profiles(id)   on delete cascade
--           -> public.tutor_subjects   (tutor_id on delete cascade)
--           -> public.tutor_packages   (tutor_id on delete cascade)
--           -> public.tutor_experience (tutor_id on delete cascade)
--           -> public.tutor_education  (tutor_id on delete cascade)
--        -> public.student_profiles(id) on delete cascade
--
-- So deleting from auth.users drains every dependent row in one shot.
delete from auth.users;

-- Defensive sweep: handle the (shouldn't-happen) case where someone inserted
-- directly into the public tables without a matching auth user. `cascade`
-- follows FK references; `restart identity` is a no-op for our uuid PKs but
-- harmless to include.
truncate table
  public.tutor_subjects,
  public.tutor_packages,
  public.tutor_experience,
  public.tutor_education,
  public.tutor_profiles,
  public.student_profiles,
  public.profiles
restart identity cascade;

commit;

-- Sanity check — every count below should be 0. `subjects` should still be 17.
select 'auth.users'              as table, count(*) from auth.users
union all select 'profiles',          count(*) from public.profiles
union all select 'tutor_profiles',    count(*) from public.tutor_profiles
union all select 'student_profiles',  count(*) from public.student_profiles
union all select 'tutor_subjects',    count(*) from public.tutor_subjects
union all select 'tutor_packages',    count(*) from public.tutor_packages
union all select 'tutor_experience',  count(*) from public.tutor_experience
union all select 'tutor_education',   count(*) from public.tutor_education
union all select 'subjects (kept)',   count(*) from public.subjects;
