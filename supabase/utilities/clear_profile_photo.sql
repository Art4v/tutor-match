-- ============================================================================
-- tutormatch — REMOVE ONE ACCOUNT'S PROFILE PHOTO BY ID (dev / admin shortcut)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Put the target account's uuid in the set_config(...) line below.
--   2. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--
-- Don't know the id? Look it up by email first (run this on its own):
--   select id, email from auth.users where email = 'someone@example.com';
--
-- WHAT IT DOES:
--   Nulls avatar_url on the account's extension row. Role-aware: both updates
--   run, but only the row that exists matches — tutors in tutor_profiles,
--   students in student_profiles (0043). The reverse of set_profile_photo.sql.
--
--   With avatar_url null the app falls back to the no-photo look: tutors get
--   their initials over avatar_bg (components/ui.js Avatar), students get the
--   same initials treatment in TopNav / /account. Nothing else changes — this
--   does NOT touch avatar_bg, banner_url, banner_bg, the profile's visibility,
--   or the account's status, and it sends no notification/email.
--
--   It also does NOT delete the underlying Storage object. The SQL Editor
--   can't remove Storage objects (storage.protect_delete() blocks SQL DELETEs
--   on storage.objects), so the old file stays in the public `profile-images`
--   bucket, orphaned but still reachable by its URL. To actually purge it, run
--   the "leftover files" query at the bottom and delete those paths in
--   Storage -> profile-images -> <uuid>/ in the dashboard.
--
-- To also clear a tutor's banner, uncomment the banner block below.
-- ============================================================================

begin;

-- >>> EDIT THIS LINE — paste the account's uuid (== profiles.id) <<<
select set_config('util.user_id', '00000000-0000-0000-0000-000000000000', false);

update public.tutor_profiles
   set avatar_url = null
 where id = current_setting('util.user_id')::uuid;

update public.student_profiles
   set avatar_url = null
 where id = current_setting('util.user_id')::uuid;

-- Also clear the tutor's banner image (uncomment to include it):
-- update public.tutor_profiles
--    set banner_url = null
--  where id = current_setting('util.user_id')::uuid;

commit;

-- Sanity check — both avatar_url columns should now read null (the row for the
-- account's other role simply doesn't exist).
select p.id,
       p.role,
       t.avatar_url as tutor_avatar_url,
       s.avatar_url as student_avatar_url
from public.profiles p
left join public.tutor_profiles t on t.id = p.id
left join public.student_profiles s on s.id = p.id
where p.id = current_setting('util.user_id')::uuid;

-- Leftover files — every object still sitting in the account's folder in the
-- public `profile-images` bucket (avatars AND banners, including older
-- timestamped uploads). Delete the ones you want gone from the dashboard's
-- Storage browser; SQL can't.
select o.name as storage_path, o.created_at
from storage.objects o
where o.bucket_id = 'profile-images'
  and o.name like current_setting('util.user_id') || '/%'
order by o.created_at desc;
