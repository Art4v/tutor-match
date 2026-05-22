-- ============================================================================
-- tutormatch — slice 6: profile images (avatar + banner uploads)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON:
--   0001_init.sql, 0002_tutor_profile.sql, 0003_tutor_dashboard.sql,
--   0004_browse.sql, 0005_default_public.sql.
--
-- WHAT THIS DOES:
--   1. Adds avatar_url + banner_url text columns to tutor_profiles. These hold
--      the public URL of an uploaded image; null means "fall back to the
--      initial + avatar_bg colour / gradient".
--   2. Creates a PUBLIC Storage bucket `profile-images`.
--   3. Adds RLS on storage.objects: anyone can read; an authenticated user can
--      write/replace/delete only files inside their own `<uid>/...` folder.
--      The app uploads to `<userId>/avatar-*.ext` and `<userId>/banner-*.ext`
--      (see lib/supabase/storage.js).
-- ============================================================================

-- 1. Columns -----------------------------------------------------------------
alter table public.tutor_profiles
  add column if not exists avatar_url text,
  add column if not exists banner_url text;

-- 2. Public bucket -----------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do update set public = true;

-- 3. RLS policies on storage.objects -----------------------------------------
-- Public read for everything in the bucket.
drop policy if exists "profile-images public read" on storage.objects;
create policy "profile-images public read"
  on storage.objects for select
  using (bucket_id = 'profile-images');

-- Owner-only writes: the first path segment must equal the caller's uid.
drop policy if exists "profile-images owner insert" on storage.objects;
create policy "profile-images owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile-images owner update" on storage.objects;
create policy "profile-images owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile-images owner delete" on storage.objects;
create policy "profile-images owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
