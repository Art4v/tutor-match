-- ============================================================================
-- tutormatch — 0072: re-approval of verified tutors' profile edits (additive)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0070, 0071.
--
-- DEPLOY ORDER: 0072 -> app deploy -> 0073.
--   Everything here is additive and safe with the previous app. 0073 then turns
--   the gate on: it stops verified tutors editing their live profile directly,
--   which is only safe once the app routes their edits through drafts.
--
-- THE PROBLEM:
--   A verified tick endorses a profile an admin reviewed. Without moderation a
--   verified tutor could change anything afterwards and keep the tick, so the
--   badge ends up vouching for content nobody saw. Separately, a tutor whose
--   request is still PENDING could change the profile under review.
--
-- THE MODEL:
--   1. Pending tutor: a REAL change withdraws the request (status back to
--      'none'); the edit goes live and they can request again. A save that
--      changes nothing does not withdraw. Visibility never counts.
--   2. Verified, non-company tutor ("gated", tutor_edits_gated()): every
--      content edit goes into one private DRAFT revision. The tutor submits it,
--      an admin approves or rejects it from an emailed link, and only approval
--      touches the live profile. Students keep seeing the live profile
--      throughout. Visibility stays instant and ungated.
--      * One open revision per tutor (draft or pending), by a partial unique
--        index. Editing while under review withdraws the submission back to a
--        draft, so only one revision is ever in flight.
--      * 'rejected' and 'withdrawn' are FINAL: each closes its row and opens a
--        fresh draft copying the content (parent_id points back). So an old
--        email link always shows what really happened to that submission.
--      * New photos and documents go to the PRIVATE profile-staging bucket and
--        are referenced from the draft. On approval the server copies them into
--        the public buckets and apply_profile_revision swaps the references.
--      * Losing verification cancels any open revision (the tutor goes back to
--        editing live).
--
-- WHAT IS IN THIS FILE:
--   1. Pending-request withdrawal: _tutor_snapshot, _withdraw_pending_verification,
--      and save_tutor_profile / the document RPCs re-created to use them.
--   2. tutor_edits_gated, and _assert_live_edit_allowed (a no-op here; 0073
--      makes it raise for gated tutors, which is the whole gate).
--   3. tutor_profile_revisions + its owner-read RLS.
--   4. Owner RPCs: save_profile_draft, submit_profile_revision,
--      discard_profile_draft, resend_profile_revision.
--   5. Service-role RPCs: apply_profile_revision, reject_profile_revision.
--   6. Cancel-on-unverify trigger.
--   7. The private profile-staging bucket.
-- ============================================================================

-- 1. Pending-request withdrawal ----------------------------------------------

-- Comparable snapshot of a tutor's public content: the name, the
-- tutor_profiles row minus bookkeeping/system/visibility columns, and the four
-- child tables in display order. Documents are handled by their own RPCs.
-- Both sides of a comparison come from the database after normalisation, so a
-- save that changes nothing compares equal.
create or replace function public._tutor_snapshot(p_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'full_name', p.full_name,
    'profile', to_jsonb(t) - array[
      'id', 'created_at', 'updated_at', 'visibility', 'slug', 'onboarded',
      'verification_status', 'verification_requested_at', 'email_confirmed_at',
      'partner_id', 'rating', 'review_count'
    ],
    'packages', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'price', price) order by position)
        from public.tutor_packages where tutor_id = p_id), '[]'::jsonb),
    'experience', coalesce((
      select jsonb_agg(jsonb_build_object('role', role, 'org', org, 'period', period, 'note', note) order by position)
        from public.tutor_experience where tutor_id = p_id), '[]'::jsonb),
    'education', coalesce((
      select jsonb_agg(jsonb_build_object('school', school, 'school_id', school_id, 'detail', detail, 'level', level) order by position)
        from public.tutor_education where tutor_id = p_id), '[]'::jsonb),
    'subjects', coalesce((
      select jsonb_agg(subject_id order by position)
        from public.tutor_subjects where tutor_id = p_id), '[]'::jsonb)
  )
  from public.tutor_profiles t
  join public.profiles p on p.id = t.id
  where t.id = p_id;
$$;

-- Send a pending request back to 'none'. True when it did.
create or replace function public._withdraw_pending_verification(p_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  update public.tutor_profiles
     set verification_status = 'none',
         verification_requested_at = null
   where id = p_id
     and verification_status = 'pending';
  return found;
end;
$$;

revoke all on function public._tutor_snapshot(uuid)                from public, anon, authenticated;
revoke all on function public._withdraw_pending_verification(uuid) from public, anon, authenticated;

-- 2. The gate -----------------------------------------------------------------

-- Whose edits need review: verified, and not a company tutor (companies are
-- not gated, and a company tutor cannot sign in anyway). SECURITY DEFINER and
-- granted to authenticated because the storage policies below call it as the
-- uploading user.
create or replace function public.tutor_edits_gated(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tutor_profiles
     where id = p_id
       and verification_status = 'verified'
       and partner_id is null
  );
$$;

revoke all     on function public.tutor_edits_gated(uuid) from public, anon;
grant  execute on function public.tutor_edits_gated(uuid) to authenticated;

-- Called by every RPC that edits the LIVE profile. Deliberately a no-op in this
-- migration so the app deployed before the draft flow keeps working; 0073
-- re-creates it to raise for gated tutors. Keeping the gate in one function
-- means 0073 cannot miss a write path.
create or replace function public._assert_live_edit_allowed(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  return;
end;
$$;

revoke all on function public._assert_live_edit_allowed(uuid) from public, anon, authenticated;

-- save_tutor_profile (0070) plus the gate hook and the before/after comparison.
-- Returns `verification_withdrawn` so the editor can tell the tutor.
create or replace function public.save_tutor_profile(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid  := public._require_own_tutor();
  v_profile   jsonb := coalesce(p_payload -> 'profile', '{}'::jsonb);
  v_avatar    text;
  v_banner    text;
  v_before    jsonb;
  v_result    jsonb;
  v_withdrawn boolean := false;
begin
  perform public._assert_live_edit_allowed(v_id);

  select avatar_url, banner_url into v_avatar, v_banner
    from public.tutor_profiles where id = v_id;

  if not public._valid_profile_image(nullif(v_profile ->> 'avatar_url', ''), v_avatar, v_id)
     or not public._valid_profile_image(nullif(v_profile ->> 'banner_url', ''), v_banner, v_id) then
    raise exception 'That photo could not be saved. Please upload it again.'
      using errcode = '22023', hint = 'invalid_image_url';
  end if;

  v_before := public._tutor_snapshot(v_id);

  if p_payload ? 'full_name' then
    perform public._apply_tutor_name(v_id, p_payload ->> 'full_name');
  end if;
  v_result := public._apply_tutor_payload(v_id, p_payload, true);

  if public._tutor_snapshot(v_id) is distinct from v_before then
    v_withdrawn := public._withdraw_pending_verification(v_id);
  end if;

  return v_result || jsonb_build_object('verification_withdrawn', v_withdrawn);
end;
$$;

revoke all     on function public.save_tutor_profile(jsonb) from public, anon;
grant  execute on function public.save_tutor_profile(jsonb) to authenticated;

-- The document RPCs (0070) plus the gate hook, and a pending request is
-- withdrawn on any real change. Signatures are unchanged; the editor re-reads
-- the status after a documents save to learn whether it was withdrawn.
create or replace function public.add_tutor_document(p_path text, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := public._require_own_tutor();
  v_title text := btrim(coalesce(p_title, ''));
  v_doc   uuid;
begin
  perform public._assert_live_edit_allowed(v_id);
  if v_title = '' or length(v_title) > 200 then
    raise exception 'A document title is required (200 characters at most).' using errcode = '22023';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> v_id::text then
    raise exception 'invalid document path' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'tutor-docs' and name = p_path) then
    raise exception 'That file has not finished uploading.' using errcode = '22023';
  end if;
  if (select count(*) from public.tutor_documents where tutor_id = v_id) >= 5 then
    raise exception 'You can upload up to 5 documents.' using errcode = '22023';
  end if;

  insert into public.tutor_documents (tutor_id, storage_path, title)
  values (v_id, p_path, v_title)
  returning id into v_doc;

  perform public._withdraw_pending_verification(v_id);
  return v_doc;
end;
$$;

create or replace function public.rename_tutor_document(p_id uuid, p_title text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := public._require_own_tutor();
  v_title text := btrim(coalesce(p_title, ''));
  v_old   text;
begin
  perform public._assert_live_edit_allowed(v_id);
  if v_title = '' or length(v_title) > 200 then
    raise exception 'A document title is required (200 characters at most).' using errcode = '22023';
  end if;
  select title into v_old from public.tutor_documents where id = p_id and tutor_id = v_id for update;
  if not found then
    raise exception 'Could not rename the document.' using errcode = '42501';
  end if;
  if v_old is distinct from v_title then
    update public.tutor_documents set title = v_title where id = p_id;
    perform public._withdraw_pending_verification(v_id);
  end if;
  return v_title;
end;
$$;

create or replace function public.delete_tutor_document(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := public._require_own_tutor();
  v_path text;
begin
  perform public._assert_live_edit_allowed(v_id);
  delete from public.tutor_documents where id = p_id and tutor_id = v_id
  returning storage_path into v_path;
  if v_path is null then
    raise exception 'Could not remove the document.' using errcode = '42501';
  end if;
  perform public._withdraw_pending_verification(v_id);
  return v_path;
end;
$$;

revoke all     on function public.add_tutor_document(text, text)      from public, anon;
revoke all     on function public.rename_tutor_document(uuid, text)   from public, anon;
revoke all     on function public.delete_tutor_document(uuid)         from public, anon;
grant  execute on function public.add_tutor_document(text, text)      to authenticated;
grant  execute on function public.rename_tutor_document(uuid, text)   to authenticated;
grant  execute on function public.delete_tutor_document(uuid)         to authenticated;

-- 3. Revisions table ----------------------------------------------------------
-- payload is exactly what save_tutor_profile takes (minus visibility), plus
-- `documents`:
--   { full_name, profile: { …scalars }, packages, experience, education,
--     subjects, documents: [{ id | null, title, path | null, staged_path | null }] }
-- A new photo is stored in profile.avatar_url / banner_url as
-- 'staging:<uid>/<file>' (a path in the private profile-staging bucket).
-- applied_payload is the payload as applied, with staged references swapped
-- for the public ones, kept for the record.
create table if not exists public.tutor_profile_revisions (
  id                uuid primary key default gen_random_uuid(),
  tutor_id          uuid not null references public.tutor_profiles(id) on delete cascade,
  status            text not null default 'draft'
                    constraint tutor_profile_revisions_status_check
                    check (status in ('draft', 'pending', 'approved', 'rejected', 'withdrawn', 'discarded', 'cancelled')),
  payload           jsonb not null,
  applied_payload   jsonb,
  -- The revision this draft was copied from (a rejected or withdrawn one).
  parent_id         uuid references public.tutor_profile_revisions(id) on delete set null,
  -- The admin's optional rejection reason.
  reason            text
                    constraint tutor_profile_revisions_reason_check
                    check (reason is null or (btrim(reason) <> '' and length(reason) <= 500)),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  -- Last time the admin was emailed a link for this revision. Durable, so the
  -- once-a-day resend limit survives serverless instance churn.
  admin_notified_at timestamptz,
  decided_at        timestamptz
);

create unique index if not exists tutor_profile_revisions_one_open
  on public.tutor_profile_revisions (tutor_id)
  where status in ('draft', 'pending');

create index if not exists tutor_profile_revisions_tutor_idx
  on public.tutor_profile_revisions (tutor_id, created_at desc);

alter table public.tutor_profile_revisions enable row level security;

-- Owner read only. Every write goes through the RPCs below.
drop policy if exists "tutor_profile_revisions owner read" on public.tutor_profile_revisions;
create policy "tutor_profile_revisions owner read"
  on public.tutor_profile_revisions for select
  using (auth.uid() = tutor_id);

-- 4. Owner RPCs ----------------------------------------------------------------

-- Does an object exist in the private staging bucket?
create or replace function public._staging_object_exists(p_path text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from storage.objects where bucket_id = 'profile-staging' and name = p_path);
$$;

-- Every staging path a payload references (photos + new documents).
create or replace function public._payload_staged_paths(p_payload jsonb)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct path), '{}'::text[]) from (
    select substr(v, 9) as path
      from (values (p_payload -> 'profile' ->> 'avatar_url'),
                   (p_payload -> 'profile' ->> 'banner_url')) as x(v)
     where v like 'staging:%'
    union all
    select d ->> 'staged_path'
      from jsonb_array_elements(coalesce(p_payload -> 'documents', '[]'::jsonb)) d
     where coalesce(d ->> 'staged_path', '') <> ''
  ) s;
$$;

-- May this value be a draft photo? Empty, unchanged from live, or a file that
-- exists in the tutor's own staging folder.
create or replace function public._valid_draft_image(p_value text, p_live text, p_folder uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_path text;
begin
  if p_value is null or p_value = '' or p_value = p_live then
    return true;
  end if;
  if p_value not like 'staging:%' then
    return false;
  end if;
  v_path := substr(p_value, 9);
  return split_part(v_path, '/', 1) = p_folder::text
     and substr(v_path, length(p_folder::text) + 2) ~ '^[A-Za-z0-9._-]+$'
     and public._staging_object_exists(v_path);
end;
$$;

revoke all on function public._staging_object_exists(text)           from public, anon, authenticated;
revoke all on function public._payload_staged_paths(jsonb)           from public, anon, authenticated;
revoke all on function public._valid_draft_image(text, text, uuid)   from public, anon, authenticated;

-- Save the caller's draft. Validates everything the live save would, plus the
-- draft-only references (staged photos, document ids, staged documents). If a
-- submission is under review it is withdrawn (final) and a fresh draft opened
-- in its place. Returns the staging paths the previous draft referenced and
-- this one no longer does, so the client can delete those files.
create or replace function public.save_profile_draft(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid := public._require_own_tutor();
  v_payload   jsonb;
  v_profile   jsonb;
  v_name      text;
  v_live_av   text;
  v_live_bn   text;
  v_in_docs   jsonb;
  v_docs      jsonb := '[]'::jsonb;
  v_doc       jsonb;
  v_title     text;
  v_doc_path  text;
  v_staged    text;
  v_open_id   uuid;
  v_open_st   text;
  v_open_pl   jsonb;
  v_rev       uuid;
  v_withdrew  boolean := false;
  v_orphans   text[] := '{}';
begin
  if not public.tutor_edits_gated(v_id) then
    raise exception 'Only verified tutors save drafts.' using errcode = '42501';
  end if;

  -- Visibility is never part of a revision: it stays instant.
  v_payload := coalesce(p_payload, '{}'::jsonb) #- '{profile,visibility}';
  v_profile := coalesce(v_payload -> 'profile', '{}'::jsonb);

  v_name := btrim(coalesce(v_payload ->> 'full_name', ''));
  if v_name = '' then
    raise exception 'Your full name is required.' using errcode = '22023';
  end if;
  v_payload := jsonb_set(v_payload, '{full_name}', to_jsonb(v_name));

  -- Same data rules as the live save (one ATAR, at most 99.95).
  perform public._atar_from_credentials(v_profile -> 'credentials');

  select avatar_url, banner_url into v_live_av, v_live_bn
    from public.tutor_profiles where id = v_id;
  if not public._valid_draft_image(nullif(v_profile ->> 'avatar_url', ''), v_live_av, v_id)
     or not public._valid_draft_image(nullif(v_profile ->> 'banner_url', ''), v_live_bn, v_id) then
    raise exception 'That photo could not be saved. Please upload it again.'
      using errcode = '22023', hint = 'invalid_image_url';
  end if;

  -- Documents: existing ones by id (the path is taken from the row, never the
  -- client), new ones by a staged path in the caller's own folder.
  v_in_docs := coalesce(v_payload -> 'documents', '[]'::jsonb);
  if jsonb_typeof(v_in_docs) <> 'array' or jsonb_array_length(v_in_docs) > 5 then
    raise exception 'You can upload up to 5 documents.' using errcode = '22023';
  end if;
  for v_doc in select value from jsonb_array_elements(v_in_docs) loop
    v_title := btrim(coalesce(v_doc ->> 'title', ''));
    if v_title = '' or length(v_title) > 200 then
      raise exception 'A document title is required (200 characters at most).' using errcode = '22023';
    end if;
    if coalesce(v_doc ->> 'id', '') <> '' then
      select storage_path into v_doc_path
        from public.tutor_documents
       where id = (v_doc ->> 'id')::uuid and tutor_id = v_id;
      if v_doc_path is null then
        raise exception 'Unknown document.' using errcode = '22023';
      end if;
      v_docs := v_docs || jsonb_build_array(jsonb_build_object(
        'id', v_doc ->> 'id', 'title', v_title, 'path', v_doc_path, 'staged_path', null));
    else
      v_staged := v_doc ->> 'staged_path';
      if v_staged is null
         or split_part(v_staged, '/', 1) <> v_id::text
         or not public._staging_object_exists(v_staged) then
        raise exception 'That file has not finished uploading.' using errcode = '22023';
      end if;
      v_docs := v_docs || jsonb_build_array(jsonb_build_object(
        'id', null, 'title', v_title, 'path', null, 'staged_path', v_staged));
    end if;
  end loop;
  v_payload := jsonb_set(v_payload, '{documents}', v_docs);

  select id, status, payload into v_open_id, v_open_st, v_open_pl
    from public.tutor_profile_revisions
   where tutor_id = v_id and status in ('draft', 'pending')
   for update;

  if v_open_id is null then
    insert into public.tutor_profile_revisions (tutor_id, status, payload)
    values (v_id, 'draft', v_payload)
    returning id into v_rev;
  else
    v_orphans := array(
      select unnest(public._payload_staged_paths(v_open_pl))
      except
      select unnest(public._payload_staged_paths(v_payload))
    );
    if v_open_st = 'pending' then
      -- Editing while under review: close the submission for good, so its
      -- email link reports "withdrawn", and continue in a fresh draft.
      update public.tutor_profile_revisions
         set status = 'withdrawn', decided_at = now(), updated_at = now()
       where id = v_open_id;
      insert into public.tutor_profile_revisions (tutor_id, status, payload, parent_id)
      values (v_id, 'draft', v_payload, v_open_id)
      returning id into v_rev;
      v_withdrew := true;
    else
      update public.tutor_profile_revisions
         set payload = v_payload, updated_at = now()
       where id = v_open_id;
      v_rev := v_open_id;
    end if;
  end if;

  return jsonb_build_object(
    'revision_id', v_rev,
    'withdrew_submission', v_withdrew,
    'orphaned_staged', to_jsonb(v_orphans)
  );
end;
$$;

-- Send the caller's draft for review. The route checks there is something to
-- review before calling this and emails the admin afterwards.
create or replace function public.submit_profile_revision()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid := public._require_own_tutor();
  v_rev uuid;
begin
  if not public.tutor_edits_gated(v_id) then
    raise exception 'Only verified tutors submit changes for review.' using errcode = '42501';
  end if;
  update public.tutor_profile_revisions
     set status = 'pending', submitted_at = now(), admin_notified_at = now(), updated_at = now()
   where tutor_id = v_id and status = 'draft'
  returning id into v_rev;
  if v_rev is null then
    raise exception 'There are no changes to submit.' using errcode = '22023';
  end if;
  return v_rev;
end;
$$;

-- Drop the caller's open revision (a draft, or a submission under review) and
-- go back to the live profile. Returns the staging paths to delete.
create or replace function public.discard_profile_draft()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid := public._require_own_tutor();
  v_payload jsonb;
begin
  update public.tutor_profile_revisions
     set status = 'discarded', decided_at = now(), updated_at = now()
   where tutor_id = v_id and status in ('draft', 'pending')
  returning payload into v_payload;
  return jsonb_build_object(
    'discarded', v_payload is not null,
    'staged', to_jsonb(coalesce(public._payload_staged_paths(v_payload), '{}'::text[]))
  );
end;
$$;

-- Re-send the admin link for the caller's submission, at most once a day. The
-- route signs a fresh 30-day token and emails it after this succeeds.
create or replace function public.resend_profile_revision()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := public._require_own_tutor();
  v_rev  uuid;
  v_last timestamptz;
begin
  select id, admin_notified_at into v_rev, v_last
    from public.tutor_profile_revisions
   where tutor_id = v_id and status = 'pending'
   for update;
  if v_rev is null then
    raise exception 'Nothing is under review.' using errcode = '22023';
  end if;
  if v_last is not null and v_last > now() - interval '24 hours' then
    raise exception 'You can resend once a day.' using errcode = '22023', hint = 'too_soon';
  end if;
  update public.tutor_profile_revisions
     set admin_notified_at = now(), updated_at = now()
   where id = v_rev;
  return v_rev;
end;
$$;

revoke all     on function public.save_profile_draft(jsonb)       from public, anon;
revoke all     on function public.submit_profile_revision()       from public, anon;
revoke all     on function public.discard_profile_draft()         from public, anon;
revoke all     on function public.resend_profile_revision()       from public, anon;
grant  execute on function public.save_profile_draft(jsonb)       to authenticated;
grant  execute on function public.submit_profile_revision()       to authenticated;
grant  execute on function public.discard_profile_draft()         to authenticated;
grant  execute on function public.resend_profile_revision()       to authenticated;

-- 5. Service-role RPCs (the admin acts through signed email links) -----------

-- Apply an approved revision to the live profile, in one transaction.
-- p_file_map maps each staged reference to its public copy, which the approve
-- route has already made:
--   'staging:<path>' -> public profile-images URL   (photos)
--   '<staged path>'  -> tutor-docs storage path      (documents)
-- Returns { applied: false, status } when the revision is no longer pending
-- (a double click, or the tutor withdrew it first), or { applied: false,
-- reason: 'not_gated' } when the tutor lost verification. On success returns
-- the files the live profile stopped referencing, for the route to delete.
create or replace function public.apply_profile_revision(p_revision_id uuid, p_file_map jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor      uuid;
  v_status     text;
  v_payload    jsonb;
  v_map        jsonb := coalesce(p_file_map, '{}'::jsonb);
  v_key        text;
  v_value      text;
  v_old_avatar text;
  v_old_banner text;
  v_doc        jsonb;
  v_keep       uuid[] := '{}';
  v_removed    text[] := '{}';
  v_replaced   text[] := '{}';
  v_mapped     text;
begin
  select tutor_id, status, payload into v_tutor, v_status, v_payload
    from public.tutor_profile_revisions where id = p_revision_id
   for update;
  if v_tutor is null then
    return jsonb_build_object('applied', false, 'status', null);
  end if;
  if v_status <> 'pending' then
    return jsonb_build_object('applied', false, 'status', v_status);
  end if;
  if not public.tutor_edits_gated(v_tutor) then
    return jsonb_build_object('applied', false, 'status', v_status, 'reason', 'not_gated');
  end if;

  select avatar_url, banner_url into v_old_avatar, v_old_banner
    from public.tutor_profiles where id = v_tutor
   for update;

  -- Photos: swap each staged reference for its public copy.
  foreach v_key in array array['avatar_url', 'banner_url'] loop
    v_value := v_payload -> 'profile' ->> v_key;
    if v_value like 'staging:%' then
      v_mapped := v_map ->> v_value;
      if v_mapped is null then
        raise exception 'missing public copy for %', v_value;
      end if;
      v_payload := jsonb_set(v_payload, array['profile', v_key], to_jsonb(v_mapped));
    end if;
  end loop;

  -- Documents: retitle the kept ones, delete the dropped ones, add the new.
  for v_doc in select value from jsonb_array_elements(coalesce(v_payload -> 'documents', '[]'::jsonb)) loop
    if coalesce(v_doc ->> 'id', '') <> '' then
      v_keep := v_keep || (v_doc ->> 'id')::uuid;
      update public.tutor_documents
         set title = v_doc ->> 'title'
       where id = (v_doc ->> 'id')::uuid and tutor_id = v_tutor;
    end if;
  end loop;

  with gone as (
    delete from public.tutor_documents
     where tutor_id = v_tutor and not (id = any(v_keep))
    returning storage_path
  )
  select coalesce(array_agg(storage_path), '{}'::text[]) into v_removed from gone;

  for v_doc in select value from jsonb_array_elements(coalesce(v_payload -> 'documents', '[]'::jsonb)) loop
    if coalesce(v_doc ->> 'id', '') = '' then
      v_mapped := v_map ->> (v_doc ->> 'staged_path');
      if v_mapped is null then
        raise exception 'missing public copy for %', v_doc ->> 'staged_path';
      end if;
      insert into public.tutor_documents (tutor_id, storage_path, title)
      values (v_tutor, v_mapped, v_doc ->> 'title');
    end if;
  end loop;

  -- The profile itself, through the same statements a live save runs.
  perform public._apply_tutor_name(v_tutor, v_payload ->> 'full_name');
  perform public._apply_tutor_payload(v_tutor, v_payload, false);

  if v_old_avatar is not null and v_old_avatar is distinct from (v_payload -> 'profile' ->> 'avatar_url') then
    v_replaced := v_replaced || v_old_avatar;
  end if;
  if v_old_banner is not null and v_old_banner is distinct from (v_payload -> 'profile' ->> 'banner_url') then
    v_replaced := v_replaced || v_old_banner;
  end if;

  update public.tutor_profile_revisions
     set status = 'approved', applied_payload = v_payload, decided_at = now(), updated_at = now()
   where id = p_revision_id;

  return jsonb_build_object(
    'applied', true,
    'tutor_id', v_tutor,
    'replaced_images', to_jsonb(v_replaced),
    'removed_docs', to_jsonb(v_removed)
  );
end;
$$;

-- Reject a submission. The tutor stays verified; the content comes back as a
-- new draft (parent_id -> this row) so they can fix it or discard it.
create or replace function public.reject_profile_revision(p_revision_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor   uuid;
  v_status  text;
  v_payload jsonb;
begin
  select tutor_id, status, payload into v_tutor, v_status, v_payload
    from public.tutor_profile_revisions where id = p_revision_id
   for update;
  if v_tutor is null or v_status <> 'pending' then
    return jsonb_build_object('rejected', false, 'status', v_status);
  end if;

  update public.tutor_profile_revisions
     set status = 'rejected',
         reason = nullif(btrim(coalesce(p_reason, '')), ''),
         decided_at = now(),
         updated_at = now()
   where id = p_revision_id;

  insert into public.tutor_profile_revisions (tutor_id, status, payload, parent_id)
  values (v_tutor, 'draft', v_payload, p_revision_id);

  return jsonb_build_object('rejected', true, 'tutor_id', v_tutor);
end;
$$;

revoke all     on function public.apply_profile_revision(uuid, jsonb)  from public, anon, authenticated;
revoke all     on function public.reject_profile_revision(uuid, text)  from public, anon, authenticated;
grant  execute on function public.apply_profile_revision(uuid, jsonb)  to service_role;
grant  execute on function public.reject_profile_revision(uuid, text)  to service_role;

-- 6. Losing verification cancels any open revision ----------------------------
-- An unverified tutor edits live again, so a draft they could no longer submit
-- (or a submission an admin could no longer approve) is closed. Staged files it
-- referenced are left in the private bucket; they are invisible and small.
create or replace function public.tutor_profiles_cancel_revisions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.verification_status = 'verified' and new.verification_status is distinct from 'verified' then
    update public.tutor_profile_revisions
       set status = 'cancelled', decided_at = now(), updated_at = now()
     where tutor_id = new.id and status in ('draft', 'pending');
  end if;
  return new;
end;
$$;

revoke all on function public.tutor_profiles_cancel_revisions() from public, anon, authenticated;

drop trigger if exists tutor_profiles_cancel_revisions on public.tutor_profiles;
create trigger tutor_profiles_cancel_revisions
  after update of verification_status on public.tutor_profiles
  for each row execute function public.tutor_profiles_cancel_revisions();

-- 7. Private staging bucket ---------------------------------------------------
-- Draft photos and documents live here until approval, at <uid>/<file>. Never
-- public: the owner reads them through signed URLs, the admin through the
-- service role. Only a gated tutor may upload (nobody else has drafts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-staging', 'profile-staging', false, 10485760, array['image/*', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/*', 'application/pdf'];

drop policy if exists "profile-staging owner select" on storage.objects;
create policy "profile-staging owner select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-staging'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile-staging owner insert" on storage.objects;
create policy "profile-staging owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-staging'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.tutor_edits_gated(auth.uid())
  );

drop policy if exists "profile-staging owner delete" on storage.objects;
create policy "profile-staging owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-staging'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
