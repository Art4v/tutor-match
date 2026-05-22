-- ============================================================================
-- tutormatch — DELETE ONE USER BY ID (dev only)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Put the target user's uuid in the set_config(...) line below (one spot).
--   2. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--
-- Don't know the id? Look it up by email first (run this on its own):
--   select id, email from auth.users where email = 'someone@example.com';
--
-- WARNING — this is destructive for that ONE account. Deleting the
-- `auth.users` row cascades (via `on delete cascade`) to:
--   * public.profiles  ->  public.tutor_profiles  ->  the four child tables
--     (tutor_subjects, tutor_packages, tutor_experience, tutor_education)
--   * public.student_profiles
-- and this script also removes that user's uploaded avatar/banner files from
-- the `profile-images` Storage bucket (folder `<uid>/...`, see 0006).
--
-- WHAT IT PRESERVES:
--   * Every other user and all their data.
--   * The schema, RLS policies, functions/triggers, the seeded `subjects`
--     table, and the `profile-images` bucket itself.
-- ============================================================================

begin;

-- >>> EDIT THIS LINE — paste the auth.users.id (uuid) to delete <<<
-- Stored as a session setting so the id only appears once below. `false` keeps
-- it set past the commit so the sanity check at the bottom can reuse it.
select set_config('reset.user_id', '00000000-0000-0000-0000-000000000000', false);

-- 1. Their uploaded profile images. The app uploads to `<userId>/avatar-*.ext`
--    and `<userId>/banner-*.ext`, so the first path segment is the user id.
delete from storage.objects
where bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = current_setting('reset.user_id');

-- 2. The account itself. The FK cascade drains every dependent public.* row.
delete from auth.users
where id = current_setting('reset.user_id')::uuid;

commit;

-- Sanity check — every count below should be 0 for the deleted id.
select 'auth.users'             as table, count(*) from auth.users             where id = current_setting('reset.user_id')::uuid
union all select 'profiles',          count(*) from public.profiles         where id = current_setting('reset.user_id')::uuid
union all select 'tutor_profiles',    count(*) from public.tutor_profiles   where id = current_setting('reset.user_id')::uuid
union all select 'student_profiles',  count(*) from public.student_profiles where id = current_setting('reset.user_id')::uuid
union all select 'tutor_subjects',    count(*) from public.tutor_subjects   where tutor_id = current_setting('reset.user_id')::uuid
union all select 'tutor_packages',    count(*) from public.tutor_packages   where tutor_id = current_setting('reset.user_id')::uuid
union all select 'tutor_experience',  count(*) from public.tutor_experience where tutor_id = current_setting('reset.user_id')::uuid
union all select 'tutor_education',   count(*) from public.tutor_education  where tutor_id = current_setting('reset.user_id')::uuid
union all select 'profile-images objects', count(*) from storage.objects where bucket_id = 'profile-images' and (storage.foldername(name))[1] = current_setting('reset.user_id');
