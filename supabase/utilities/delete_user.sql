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
--   * public.profiles  ->  public.tutor_profiles  ->  the five child tables
--     (tutor_subjects, tutor_packages, tutor_experience, tutor_education,
--      tutor_documents)
--   * public.student_profiles
--   * public.notifications   (keyed straight off auth.users.id)
--   * public.ai_usage        (keyed straight off auth.users.id)
--
-- DOES NOT delete the user's uploaded files: Supabase blocks direct DELETEs on
-- storage tables (a `storage.protect_delete()` trigger), so those must go
-- through the Storage API. The last queries below LIST the files to remove;
-- delete the `<uid>/` folder in Studio -> Storage -> profile-images AND
-- tutor-docs (or via the Storage API). Leftover files are orphaned but mostly
-- harmless — nothing references them once the tutor row is gone (public-bucket
-- tutor-docs files do stay fetchable by raw URL until removed, hence the
-- listing).
--
-- WHAT IT PRESERVES:
--   * Every other user and all their data.
--   * The schema, RLS policies, functions/triggers, the seeded `subjects` /
--     `schools` tables, and the `profile-images` / `tutor-docs` buckets
--     themselves.
-- ============================================================================

begin;

-- >>> EDIT THIS LINE — paste the auth.users.id (uuid) to delete <<<
-- Stored as a session setting so the id only appears once below. `false` keeps
-- it set past the commit so the queries at the bottom can reuse it.
select set_config('reset.user_id', '00000000-0000-0000-0000-000000000000', false);

-- The account itself. The FK cascade drains every dependent public.* row.
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
union all select 'tutor_documents',   count(*) from public.tutor_documents  where tutor_id = current_setting('reset.user_id')::uuid
union all select 'notifications',     count(*) from public.notifications    where user_id  = current_setting('reset.user_id')::uuid
union all select 'ai_usage',          count(*) from public.ai_usage         where user_id  = current_setting('reset.user_id')::uuid;

-- Storage cleanup TODO — these are the user's leftover files (DELETE is
-- blocked in SQL; remove them via Studio -> Storage, per bucket). tutor-docs
-- is a PUBLIC bucket, so its files stay fetchable by raw URL until removed.
select bucket_id, name, id
from storage.objects
where bucket_id in ('profile-images', 'tutor-docs')
  and (storage.foldername(name))[1] = current_setting('reset.user_id');
