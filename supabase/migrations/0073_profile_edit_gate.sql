-- ============================================================================
-- tutormatch — 0073: verified tutors' edits require review (the gate)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0072, AND the app deploy that routes verified tutors' edits
--   through drafts (save_profile_draft / the staging bucket). Run it before
--   that deploy and verified tutors simply cannot save.
--
-- WHAT THIS DOES:
--   1. _assert_live_edit_allowed (a no-op in 0072) now raises for a gated
--      tutor. Every RPC that edits the live profile calls it first:
--      save_tutor_profile, add_tutor_document, rename_tutor_document,
--      delete_tutor_document. So a verified tutor can no longer change their
--      public profile from the browser console; the only way in is a draft an
--      admin approves (apply_profile_revision, service role, which does not
--      call it). set_tutor_visibility and mark_tutor_onboarded do not call it:
--      visibility stays instant.
--   2. A gated tutor can no longer upload straight into the PUBLIC buckets
--      (profile-images, tutor-docs). Their new files go to the private
--      profile-staging bucket (0072) and are copied across on approval.
--      Everyone else (unverified tutors, students, company owners) is
--      unaffected: tutor_edits_gated() is false for them. Read policies are
--      unchanged.
-- ============================================================================

-- 1. The gate -----------------------------------------------------------------
create or replace function public._assert_live_edit_allowed(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if public.tutor_edits_gated(p_id) then
    raise exception 'Your profile is verified, so changes go to a draft for review.'
      using errcode = '42501', hint = 'profile_changes_require_review';
  end if;
end;
$$;

revoke all on function public._assert_live_edit_allowed(uuid) from public, anon, authenticated;

-- 2. No direct uploads to the public buckets for gated tutors -----------------
drop policy if exists "profile-images owner insert" on storage.objects;
create policy "profile-images owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.tutor_edits_gated(auth.uid())
  );

drop policy if exists "profile-images owner update" on storage.objects;
create policy "profile-images owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.tutor_edits_gated(auth.uid())
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.tutor_edits_gated(auth.uid())
  );

drop policy if exists "tutor-docs owner insert" on storage.objects;
create policy "tutor-docs owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tutor-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.tutor_edits_gated(auth.uid())
  );
