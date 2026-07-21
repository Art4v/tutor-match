-- ============================================================================
-- tutormatch — SET ONE ACCOUNT'S PROFILE PHOTO BY ID (dev / admin shortcut)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Put the target account's uuid in the first set_config(...) line below.
--   2. Optionally put an image URL in the second set_config(...) line. Leave it
--      '' (empty) to auto-generate a deterministic placeholder avatar
--      (DiceBear "thumbs", seeded by the uuid — same id always yields the same
--      face, so re-runs are idempotent).
--   3. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--
-- Don't know the id? Look it up by email first (run this on its own):
--   select id, email from auth.users where email = 'someone@example.com';
--
-- WHAT IT DOES:
--   Sets avatar_url on the account's extension row WITHOUT going through the
--   app's upload flow (lib/supabase/storage.js uploadProfileImage). Role-aware:
--   both updates below run, but only the row that exists matches — tutors in
--   tutor_profiles, students in student_profiles (0043). The app treats
--   avatar_url as an opaque public URL (plain <img>/background, no next/image
--   allowlist), so any reachable image URL works:
--     * a real upload's URL — .../storage/v1/object/public/profile-images/...
--       (paste one from the Storage browser to reuse an existing object), or
--     * any external image (the generated placeholder is this kind).
--
--   It does NOT upload anything to the `profile-images` bucket — the SQL
--   Editor can't write Storage objects, so an external URL lives outside the
--   bucket's lifecycle (nothing to orphan, nothing deleted with the account).
--   It also does NOT touch avatar_bg / initials (the no-photo fallback look,
--   tutors only) — clearing the URL simply falls back to them.
--
--   Requires migration 0043 for the student path (the tutor column predates
--   the numbered utilities).
--
-- To REMOVE a photo instead, set avatar_url = null on the same row (uncomment
-- the block at the bottom).
-- ============================================================================

begin;

-- >>> EDIT THIS LINE — paste the account's uuid (== profiles.id) <<<
select set_config('util.user_id', '00000000-0000-0000-0000-000000000000', false);

-- >>> OPTIONALLY EDIT — an image URL, or leave '' for a generated placeholder <<<
select set_config('util.image_url', '', false);

-- Resolve the final URL once: pasted URL wins, else the seeded placeholder.
select set_config(
  'util.final_url',
  coalesce(
    nullif(trim(current_setting('util.image_url')), ''),
    'https://api.dicebear.com/9.x/thumbs/svg?seed=' || current_setting('util.user_id')
  ),
  false
);

update public.tutor_profiles
   set avatar_url = current_setting('util.final_url')
 where id = current_setting('util.user_id')::uuid;

update public.student_profiles
   set avatar_url = current_setting('util.final_url')
 where id = current_setting('util.user_id')::uuid;

-- Remove the photo (uncomment to use instead of the updates above):
-- update public.tutor_profiles
--    set avatar_url = null
--  where id = current_setting('util.user_id')::uuid;
-- update public.student_profiles
--    set avatar_url = null
--  where id = current_setting('util.user_id')::uuid;

commit;

-- Sanity check — confirm the new state (one avatar_url is non-null for the
-- account's role; the other row doesn't exist).
select p.id,
       p.role,
       t.avatar_url as tutor_avatar_url,
       s.avatar_url as student_avatar_url
from public.profiles p
left join public.tutor_profiles t on t.id = p.id
left join public.student_profiles s on s.id = p.id
where p.id = current_setting('util.user_id')::uuid;
