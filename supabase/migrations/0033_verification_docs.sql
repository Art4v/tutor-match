-- ============================================================================
-- tutormatch — slice 33: verification supporting documents
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON:
--   0006_profile_images.sql (same storage RLS pattern),
--   0021_verification_and_notifications.sql (the verification flow this feeds).
--
-- WHAT THIS DOES:
--   1. Creates a PRIVATE Storage bucket `verification-docs` for the documents
--      tutors attach to a verification request (WWCC, transcripts, ID — PDF or
--      image). Private, unlike `profile-images`: these are sensitive. The
--      bucket itself enforces a 10 MB per-file cap and PDF/image MIME types,
--      so the limits hold even if the client-side checks are bypassed.
--   2. Adds RLS on storage.objects: the OWNER can read/list, upload, and
--      delete files inside their own `<uid>/...` folder. Nobody else can read
--      — the admin review page uses the service-role client (bypasses RLS)
--      and mints short-lived signed URLs.
--      No UPDATE policy on purpose: files are immutable (delete + re-upload),
--      so uploads must NOT use upsert (the x-upsert header needs UPDATE).
--
--   Documents are deleted by the approve/reject routes as soon as an admin
--   decides, so they only exist while a review is pending. The app uploads to
--   `<userId>/<timestamp>-<filename>` (see lib/supabase/storage.js).
-- ============================================================================

-- 1. Private bucket with server-side size + MIME enforcement ------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-docs', 'verification-docs', false, 10485760, array['application/pdf', 'image/*'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/*'];

-- 2. RLS policies on storage.objects -----------------------------------------
-- Owner-only read: .list() and downloads run under the SELECT policy.
drop policy if exists "verification-docs owner select" on storage.objects;
create policy "verification-docs owner select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "verification-docs owner insert" on storage.objects;
create policy "verification-docs owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "verification-docs owner delete" on storage.objects;
create policy "verification-docs owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
