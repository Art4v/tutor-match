-- ============================================================================
-- tutormatch — slice 34: public tutor documentation (replaces verification docs)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--   2. MANUAL STEP — delete the old bucket. SQL cannot do it: Supabase's
--      storage.protect_delete() trigger blocks direct DELETEs on
--      storage.objects / storage.buckets ("Use the Storage API instead").
--      Dashboard -> Storage -> `verification-docs` -> bucket menu ->
--      Empty bucket, then Delete bucket.
--
-- DEPENDS ON:
--   0033_verification_docs.sql (the private bucket this retires).
--
-- WHAT THIS DOES:
--   Documents leave the verification pipeline entirely and become permanent,
--   PUBLIC profile content (the "Documentation" card on /tutor/[slug]).
--
--   1. Retires the private `verification-docs` bucket: drops its RLS policies
--      here; the bucket + files are removed in the dashboard (manual step
--      above). Its objects are DELETED, not migrated: they were uploaded
--      under an explicit "private + deleted after review" promise, so
--      republishing them publicly is off the table — tutors re-upload through
--      the new card, which warns that files are public.
--   2. Creates the PUBLIC bucket `tutor-docs` with the same server-side
--      enforcement (10 MB per file, PDF/image MIME) and the same
--      `<uid>/<timestamp>-<name>` layout (see lib/supabase/storage.js).
--      storage.objects policies: owner-scoped INSERT/DELETE only. No SELECT
--      policy — the app reads the `tutor_documents` table, never lists the
--      bucket, and downloads on a public bucket bypass RLS. (This turned out
--      to break owner deletes — fixed by the owner SELECT policy in 0035.)
--      Still no UPDATE policy: files are immutable (delete + re-upload), so
--      uploads must NOT use upsert.
--   3. Creates `tutor_documents` — the metadata table the app reads. One row
--      per file: the storage path plus the tutor-chosen TITLE shown on the
--      card (never the raw filename). Public read; owner
--      INSERT/UPDATE/DELETE (UPDATE = retitling). Rows cascade with the
--      tutor via the FK; on account deletion the storage files orphan
--      (accepted — same gap as 0015's note on profile-images).
-- ============================================================================

-- 1. Retire the private verification-docs bucket ------------------------------
-- Only the policies can be dropped in SQL (storage.protect_delete blocks
-- deleting the objects/bucket rows) — the bucket itself is emptied and
-- deleted in the dashboard, per the manual step above. Until that's done the
-- leftover bucket is inert: with these policies gone, no client role can
-- read or write it.
drop policy if exists "verification-docs owner select" on storage.objects;
drop policy if exists "verification-docs owner insert" on storage.objects;
drop policy if exists "verification-docs owner delete" on storage.objects;

-- 2. Public bucket with server-side size + MIME enforcement -------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tutor-docs', 'tutor-docs', true, 10485760, array['application/pdf', 'image/*'])
on conflict (id) do update
  set public = true,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/*'];

drop policy if exists "tutor-docs owner insert" on storage.objects;
create policy "tutor-docs owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tutor-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "tutor-docs owner delete" on storage.objects;
create policy "tutor-docs owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'tutor-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Metadata table -----------------------------------------------------------
create table if not exists public.tutor_documents (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     uuid not null references public.tutor_profiles(id) on delete cascade,
  -- `<uid>/<timestamp>-<name>` in the tutor-docs bucket. The CHECK pins the
  -- row inside the owner's folder, so a row can never point at someone
  -- else's file.
  storage_path text not null unique
    constraint tutor_documents_path_in_owner_folder
    check (split_part(storage_path, '/', 1) = tutor_id::text),
  -- Tutor-chosen display title (the app defaults it to the cleaned filename
  -- when left blank at upload).
  title        text not null
    constraint tutor_documents_title_not_blank
    check (btrim(title) <> ''),
  uploaded_at  timestamptz not null default now()
);

create index if not exists tutor_documents_tutor_id_idx
  on public.tutor_documents (tutor_id);

alter table public.tutor_documents enable row level security;

drop policy if exists "tutor_documents public read" on public.tutor_documents;
create policy "tutor_documents public read"
  on public.tutor_documents for select using (true);

drop policy if exists "tutor_documents owner insert" on public.tutor_documents;
create policy "tutor_documents owner insert"
  on public.tutor_documents for insert to authenticated
  with check (auth.uid() = tutor_id);

drop policy if exists "tutor_documents owner update" on public.tutor_documents;
create policy "tutor_documents owner update"
  on public.tutor_documents for update to authenticated
  using  (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);

drop policy if exists "tutor_documents owner delete" on public.tutor_documents;
create policy "tutor_documents owner delete"
  on public.tutor_documents for delete to authenticated
  using (auth.uid() = tutor_id);
