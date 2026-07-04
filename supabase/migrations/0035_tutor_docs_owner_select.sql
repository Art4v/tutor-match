-- ============================================================================
-- tutormatch — slice 35: owner SELECT on tutor-docs (fixes owner deletes)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON:
--   0034_tutor_documents.sql (the bucket + policies this amends).
--
-- WHAT THIS DOES:
--   0034 gave the `tutor-docs` bucket owner-scoped INSERT/DELETE but no
--   SELECT policy (the app reads the `tutor_documents` table and never lists
--   the bucket; downloads on a public bucket bypass RLS). That broke owner
--   deletes: the Storage API's remove() checks SELECT as well as DELETE, and
--   without SELECT it silently returns empty — deleteTutorDoc removed the
--   table row but the file stayed in the bucket.
--
--   Adds the owner-scoped SELECT policy so remove() works. Same folder-=-uid
--   key as the other policies; still no UPDATE policy (files are immutable,
--   uploads must not use upsert).
--
--   NOTE: documents deleted from the app before this fix left orphaned files
--   in the bucket (no table row points at them). Sweep those once by hand:
--   Dashboard -> Storage -> tutor-docs.
-- ============================================================================

drop policy if exists "tutor-docs owner select" on storage.objects;
create policy "tutor-docs owner select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tutor-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
