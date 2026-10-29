-- ============================================================================
-- tutormatch — 0076: admin-managed tutors and the tutor invite page
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0075 (in order).
--
-- DEPLOY ORDER: 0076 -> app. One file is safe: nobody is managed until the new
--   app's /join page redeems the key, and every redefinition below behaves as
--   before for a tutor whose managed_at is NULL.
--
-- THE MODEL:
--   An admin copies a universal invite link (/join?k=<key>) from /admin. A
--   tutor who signs up (or opts in) through it consents to MatchTutor managing
--   their profile, which is recorded as tutor_profiles.managed_at. While it is
--   set:
--   * Admins edit the LIVE profile directly (admin_save_managed_tutor_profile,
--     the managed document RPCs, admin_set_managed_tutor_visibility), and can
--     toggle verification without a request (admin_set_tutor_verification).
--   * The tutor is "gated" exactly like a verified tutor (0072/0073): their own
--     edits become a draft in the Profile changes queue. tutor_edits_gated()
--     is the single switch, so every gate (the live-edit RPCs, the storage
--     policies, apply_profile_revision) follows without another edit.
--   * Visibility is admin-only (set_tutor_visibility raises managed_by_admin).
--   Opting out (opt_out_of_management) is the tutor's to make, from /account:
--   it clears managed_at, removes verification, withdraws any open draft and
--   deletes the private signup materials. A live invite link can opt them in
--   again later.
--
--   The key is a singleton row with no client policies. Rotating it replaces
--   the value, so the old link dies at once; an account that already redeemed
--   it is unaffected (managed_at is on the account, not the key).
--
-- WHAT IS IN THIS FILE:
--   1. tutor_invite_key (singleton) + the admin read/rotate RPCs.
--   2. tutor_profiles columns, guard + snapshot updated to know them.
--   3. tutor_edits_gated / _assert_live_edit_allowed / set_tutor_visibility /
--      the cancel-revisions trigger, made managed-aware.
--   4. Private signup materials: tutor_invite_materials + private bucket.
--   5. redeem_tutor_invite (service role), submit_invite_materials,
--      opt_out_of_management (tutor).
--   6. Admin RPCs for managed tutors.
--   7. admin_actions CHECK widened, admin_pending_counts gains `invites`.
-- ============================================================================

-- 1. The invite key -----------------------------------------------------------
create table if not exists public.tutor_invite_key (
  id          boolean primary key default true check (id),
  key         text not null check (key ~ '^[0-9a-f]{32}$'),
  rotated_at  timestamptz not null default now(),
  rotated_by  uuid references public.profiles(id) on delete set null
);

insert into public.tutor_invite_key (id, key)
values (true, replace(gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

alter table public.tutor_invite_key enable row level security;
-- No policies: read and rotated only through the admin RPCs below, and
-- compared only inside redeem_tutor_invite.

-- 2. tutor_profiles columns -----------------------------------------------------
alter table public.tutor_profiles
  add column if not exists managed_at                    timestamptz,
  add column if not exists managed_setup_done_at         timestamptz,
  add column if not exists invite_materials_submitted_at timestamptz,
  add column if not exists admin_edited_at               timestamptz;

create index if not exists tutor_profiles_managed_idx
  on public.tutor_profiles (managed_at) where managed_at is not null;

-- 0071's guard, plus the four new system columns.
create or replace function public.tutor_profiles_guard_derived()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.rating       := old.rating;
    new.review_count := old.review_count;

    if new.verification_status is distinct from old.verification_status then
      raise exception 'protected_column:verification_status' using errcode = '42501';
    end if;
    if new.verification_requested_at is distinct from old.verification_requested_at then
      raise exception 'protected_column:verification_requested_at' using errcode = '42501';
    end if;
    if new.partner_id is distinct from old.partner_id then
      raise exception 'protected_column:partner_id' using errcode = '42501';
    end if;
    if new.slug is distinct from old.slug then
      raise exception 'protected_column:slug' using errcode = '42501';
    end if;
    if new.email_confirmed_at is distinct from old.email_confirmed_at then
      raise exception 'protected_column:email_confirmed_at' using errcode = '42501';
    end if;
    if new.onboarded is distinct from old.onboarded then
      raise exception 'protected_column:onboarded' using errcode = '42501';
    end if;
    if new.managed_at is distinct from old.managed_at then
      raise exception 'protected_column:managed_at' using errcode = '42501';
    end if;
    if new.managed_setup_done_at is distinct from old.managed_setup_done_at then
      raise exception 'protected_column:managed_setup_done_at' using errcode = '42501';
    end if;
    if new.invite_materials_submitted_at is distinct from old.invite_materials_submitted_at then
      raise exception 'protected_column:invite_materials_submitted_at' using errcode = '42501';
    end if;
    if new.admin_edited_at is distinct from old.admin_edited_at then
      raise exception 'protected_column:admin_edited_at' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- 0072's snapshot, minus the new bookkeeping columns, so stamping one is never
-- mistaken for a content change.
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
      'partner_id', 'rating', 'review_count',
      'managed_at', 'managed_setup_done_at', 'invite_materials_submitted_at', 'admin_edited_at'
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

revoke all on function public._tutor_snapshot(uuid) from public, anon, authenticated;

-- 3. Managed tutors are gated ---------------------------------------------------
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
       and (verification_status = 'verified' or managed_at is not null)
       and partner_id is null
  );
$$;

-- No longer granted to authenticated: called with any id, it would tell a
-- signed-in user whether someone else is managed, which nothing else reveals.
-- Its callers are SECURITY DEFINER functions; the storage policies, which run
-- as the uploading user, use the caller-only wrapper below instead.
revoke all     on function public.tutor_edits_gated(uuid) from public, anon, authenticated;
grant  execute on function public.tutor_edits_gated(uuid) to service_role;

-- The same answer about the caller only (like is_admin()), for policies.
create or replace function public.caller_edits_gated()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tutor_edits_gated(auth.uid());
$$;

revoke all     on function public.caller_edits_gated() from public, anon;
grant  execute on function public.caller_edits_gated() to authenticated;

-- The 0072/0073 storage policies, unchanged except that they ask about the
-- caller through the wrapper.
drop policy if exists "profile-images owner insert" on storage.objects;
create policy "profile-images owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.caller_edits_gated()
  );

drop policy if exists "profile-images owner update" on storage.objects;
create policy "profile-images owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.caller_edits_gated()
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.caller_edits_gated()
  );

drop policy if exists "tutor-docs owner insert" on storage.objects;
create policy "tutor-docs owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tutor-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.caller_edits_gated()
  );

drop policy if exists "profile-staging owner insert" on storage.objects;
create policy "profile-staging owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-staging'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.caller_edits_gated()
  );

-- 0073's gate with a message that is true for both kinds of gated tutor.
create or replace function public._assert_live_edit_allowed(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if public.tutor_edits_gated(p_id) then
    raise exception 'Changes to your profile go to a draft for review.'
      using errcode = '42501', hint = 'profile_changes_require_review';
  end if;
end;
$$;

revoke all on function public._assert_live_edit_allowed(uuid) from public, anon, authenticated;

-- 0070's visibility RPC: admin-only while managed.
create or replace function public.set_tutor_visibility(p_visibility text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public._require_own_tutor();
begin
  if p_visibility is null or p_visibility not in ('public', 'unlisted', 'hidden') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;
  if exists (select 1 from public.tutor_profiles where id = v_id and managed_at is not null) then
    raise exception 'MatchTutor manages your profile, so we control when it is shown.'
      using errcode = '42501', hint = 'managed_by_admin';
  end if;
  update public.tutor_profiles set visibility = p_visibility, updated_at = now() where id = v_id;
  return p_visibility;
end;
$$;

revoke all     on function public.set_tutor_visibility(text) from public, anon;
grant  execute on function public.set_tutor_visibility(text) to authenticated;

-- 0072's cancel-on-unverify trigger. A managed tutor stays gated when an admin
-- removes verification, so their draft must survive it.
create or replace function public.tutor_profiles_cancel_revisions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.verification_status = 'verified'
     and new.verification_status is distinct from 'verified'
     and new.managed_at is null then
    update public.tutor_profile_revisions
       set status = 'cancelled', decided_at = now(), updated_at = now()
     where tutor_id = new.id and status in ('draft', 'pending');
  end if;
  return new;
end;
$$;

revoke all on function public.tutor_profiles_cancel_revisions() from public, anon, authenticated;

-- 4. Private signup materials -------------------------------------------------
create table if not exists public.tutor_invite_materials (
  id           uuid primary key default gen_random_uuid(),
  tutor_id     uuid not null references public.tutor_profiles(id) on delete cascade,
  kind         text not null check (kind in ('document', 'link')),
  storage_path text,
  title        text check (title is null or (btrim(title) <> '' and char_length(title) <= 200)),
  url          text check (url is null or (url ~* '^https?://[^\s]+$' and char_length(url) <= 500)),
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  constraint tutor_invite_materials_shape check (
    (kind = 'document' and storage_path is not null and title is not null and url is null
       and split_part(storage_path, '/', 1) = tutor_id::text)
    or (kind = 'link' and url is not null and storage_path is null and title is null)
  )
);

create index if not exists tutor_invite_materials_tutor_idx
  on public.tutor_invite_materials (tutor_id, kind, position);

alter table public.tutor_invite_materials enable row level security;
-- No client policies: admins read through the service role.

-- An explicit list, not image/*: an SVG can carry script, and admins open
-- these files. Mirrored by INVITE_DOC_TYPES in lib/supabase/storage.js.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tutor-invite-materials', 'tutor-invite-materials', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- May this tutor still upload signup materials? Managed and not yet submitted.
-- Asked by /api/join/materials/upload (service role) before it signs an upload,
-- and by submit_invite_materials.
create or replace function public.can_upload_invite_materials(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tutor_profiles
     where id = p_id
       and managed_at is not null
       and invite_materials_submitted_at is null
  );
$$;

revoke all     on function public.can_upload_invite_materials(uuid) from public, anon, authenticated;
grant  execute on function public.can_upload_invite_materials(uuid) to service_role;

-- The bucket has NO client policies at all. A tutor uploads only through a
-- signed upload URL that /api/join/materials/upload mints after checking the
-- session, can_upload_invite_materials, the type and size, and how many files
-- the folder already holds. A direct INSERT policy could not cap the count,
-- since a policy sees one row at a time. Admins read through the service role.
-- (The drop keeps a re-run, or a database that saw an earlier draft of this
-- file, free of the old insert policy.)
drop policy if exists "tutor-invite-materials owner insert" on storage.objects;

-- 5. Tutor-side RPCs ---------------------------------------------------------

-- Bind an account to the invite: the key says the link is current, the
-- caller (a route holding the session, through the service role) says who.
-- Takes the user id explicitly like claim_partner_as, for the same reason.
--   role NULL     -> becomes a hidden, onboarded tutor (choose_role's tutor
--                    branch, 0063).
--   tutor         -> keeps everything; only managed_at is set.
--   anything else -> wrong_role.
--   an admin      -> admin_account: every admin action refuses an admin target
--                    (_require_managed_tutor), so a managed admin could never
--                    be set up, shown or verified, only opted out.
-- Idempotent for an account that is already managed.
create or replace function public.redeem_tutor_invite(p_user_id uuid, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role         public.user_role;
  v_name         text;
  v_status       text;
  v_is_admin     boolean;
  v_partner      uuid;
  v_managed      timestamptz;
  v_confirmed_at timestamptz;
  v_created      boolean := false;
begin
  if p_user_id is null then
    raise exception 'no account' using errcode = '22023';
  end if;
  if p_key is null or not exists (select 1 from public.tutor_invite_key where key = p_key) then
    raise exception 'This invite link is no longer valid.' using errcode = '22023', hint = 'invalid_key';
  end if;

  select role, full_name, status, is_admin into v_role, v_name, v_status, v_is_admin
    from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'no profile for that account' using errcode = 'P0002';
  end if;
  if v_status <> 'enabled' then
    raise exception 'This account is disabled.' using errcode = '42501', hint = 'disabled';
  end if;
  if v_is_admin then
    raise exception 'Admin accounts cannot be managed through this link.' using errcode = '22023', hint = 'admin_account';
  end if;

  if v_role is null then
    update public.profiles set role = 'tutor' where id = p_user_id;
    select email_confirmed_at into v_confirmed_at from auth.users where id = p_user_id;
    insert into public.tutor_profiles (id, slug, email_confirmed_at, visibility, onboarded)
    values (p_user_id, p_user_id::text, v_confirmed_at, 'hidden', true);
    perform public._assign_tutor_slug(p_user_id, v_name);
    v_created := true;
  elsif v_role <> 'tutor' then
    raise exception 'Only tutor accounts can use this link.' using errcode = '22023', hint = 'wrong_role';
  end if;

  select partner_id, managed_at into v_partner, v_managed
    from public.tutor_profiles where id = p_user_id for update;
  if v_partner is not null then
    raise exception 'Only tutor accounts can use this link.' using errcode = '22023', hint = 'wrong_role';
  end if;
  if v_managed is not null then
    return jsonb_build_object('created', false, 'already', true, 'name', v_name);
  end if;

  -- onboarded too: the admins set the profile up, and /onboarding's live save
  -- would now be refused anyway (a managed tutor is gated).
  update public.tutor_profiles
     set managed_at = now(),
         managed_setup_done_at = null,
         invite_materials_submitted_at = null,
         onboarded = true
   where id = p_user_id;

  return jsonb_build_object('created', v_created, 'already', false, 'name', v_name);
end;
$$;

revoke all     on function public.redeem_tutor_invite(uuid, text) from public, anon, authenticated;
grant  execute on function public.redeem_tutor_invite(uuid, text) to service_role;

-- Is this key current? Service role only; the signup route asks before it
-- creates an account, so a dead link never leaves an orphan account behind.
create or replace function public.tutor_invite_key_valid(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_key is not null and exists (select 1 from public.tutor_invite_key where key = p_key);
$$;

revoke all     on function public.tutor_invite_key_valid(text) from public, anon, authenticated;
grant  execute on function public.tutor_invite_key_valid(text) to service_role;

-- Submit the optional signup documents + links, once. Empty arrays = Skip.
--   p_docs:  [{ path, title }]   (files already uploaded to the private bucket)
--   p_links: [ "https://…" ]
create or replace function public.submit_invite_materials(p_docs jsonb, p_links jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := public._require_own_tutor();
  v_docs  jsonb := coalesce(p_docs, '[]'::jsonb);
  v_links jsonb := coalesce(p_links, '[]'::jsonb);
  v_doc   jsonb;
  v_path  text;
  v_title text;
  v_url   text;
  v_pos   int := 0;
begin
  if not public.can_upload_invite_materials(v_id) then
    raise exception 'You have already sent your documents.' using errcode = '22023', hint = 'already_submitted';
  end if;
  if jsonb_typeof(v_docs) <> 'array' or jsonb_array_length(v_docs) > 5 then
    raise exception 'You can attach up to 5 documents.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_links) <> 'array' or jsonb_array_length(v_links) > 5 then
    raise exception 'You can add up to 5 links.' using errcode = '22023';
  end if;

  for v_doc in select value from jsonb_array_elements(v_docs) loop
    v_path  := v_doc ->> 'path';
    v_title := btrim(coalesce(v_doc ->> 'title', ''));
    if v_title = '' or length(v_title) > 200 then
      raise exception 'A document title is required (200 characters at most).' using errcode = '22023';
    end if;
    if v_path is null or split_part(v_path, '/', 1) <> v_id::text
       or not exists (select 1 from storage.objects
                       where bucket_id = 'tutor-invite-materials' and name = v_path) then
      raise exception 'That file has not finished uploading.' using errcode = '22023';
    end if;
    insert into public.tutor_invite_materials (tutor_id, kind, storage_path, title, position)
    values (v_id, 'document', v_path, v_title, v_pos);
    v_pos := v_pos + 1;
  end loop;

  v_pos := 0;
  for v_url in select btrim(value) from jsonb_array_elements_text(v_links) loop
    if v_url = '' then
      continue;
    end if;
    if v_url !~* '^https?://[^\s]+$' or length(v_url) > 500 then
      raise exception 'Links must start with http:// or https:// (500 characters at most).' using errcode = '22023';
    end if;
    insert into public.tutor_invite_materials (tutor_id, kind, url, position)
    values (v_id, 'link', v_url, v_pos);
    v_pos := v_pos + 1;
  end loop;

  update public.tutor_profiles set invite_materials_submitted_at = now() where id = v_id;
end;
$$;

revoke all     on function public.submit_invite_materials(jsonb, jsonb) from public, anon;
grant  execute on function public.submit_invite_materials(jsonb, jsonb) to authenticated;

-- The tutor withdraws consent. Final from settings (a live invite link can opt
-- them in again). Returns the storage paths of the private materials and of
-- any staged draft files, for the route to delete (Storage cannot be reached
-- from SQL).
create or replace function public.opt_out_of_management()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid := public._require_own_tutor();
  v_paths   text[];
  v_staged  text[] := '{}';
  v_payload jsonb;
begin
  if not exists (select 1 from public.tutor_profiles where id = v_id and managed_at is not null) then
    raise exception 'Your profile is not managed by MatchTutor.' using errcode = '22023', hint = 'not_managed';
  end if;

  update public.tutor_profile_revisions
     set status = 'withdrawn', decided_at = now(), updated_at = now()
   where tutor_id = v_id and status in ('draft', 'pending')
  returning payload into v_payload;
  if v_payload is not null then
    v_staged := public._payload_staged_paths(v_payload);
  end if;

  with gone as (
    delete from public.tutor_invite_materials
     where tutor_id = v_id and kind = 'document'
    returning storage_path
  )
  select coalesce(array_agg(storage_path), '{}'::text[]) into v_paths from gone;
  delete from public.tutor_invite_materials where tutor_id = v_id;

  update public.tutor_profiles
     set managed_at = null,
         managed_setup_done_at = null,
         invite_materials_submitted_at = null,
         verification_status = 'none',
         verification_requested_at = null
   where id = v_id;

  return jsonb_build_object('materials', to_jsonb(v_paths), 'staged', to_jsonb(v_staged));
end;
$$;

revoke all     on function public.opt_out_of_management() from public, anon;
grant  execute on function public.opt_out_of_management() to authenticated;

-- 6. Admin RPCs ---------------------------------------------------------------

-- The managed tutor an admin is acting on, locked. Refuses non-managed tutors,
-- company tutors, admins and the caller.
create or replace function public._require_managed_tutor(p_tutor_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := public._assert_admin_target(p_tutor_id);
  perform 1 from public.tutor_profiles
   where id = p_tutor_id and managed_at is not null and partner_id is null
   for update;
  if not found then
    raise exception 'This tutor is not managed by MatchTutor.' using errcode = '42501', hint = 'not_managed';
  end if;
  return v_name;
end;
$$;

revoke all on function public._require_managed_tutor(uuid) from public, anon, authenticated;

create or replace function public.admin_get_tutor_invite_key()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  return (
    select jsonb_build_object('key', k.key, 'rotated_at', k.rotated_at, 'rotated_by', p.full_name)
      from public.tutor_invite_key k
      left join public.profiles p on p.id = k.rotated_by
  );
end;
$$;

create or replace function public.admin_rotate_tutor_invite_key()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := replace(gen_random_uuid()::text, '-', '');
begin
  perform public._require_admin();
  insert into public.tutor_invite_key (id, key, rotated_at, rotated_by)
  values (true, v_key, now(), auth.uid())
  on conflict (id) do update
    set key = excluded.key, rotated_at = excluded.rotated_at, rotated_by = excluded.rotated_by;
  perform public._log_admin_action('tutor_invite_rotated', 'user', null, 'Tutor invite link', null);
  return jsonb_build_object('key', v_key, 'rotated_at', now());
end;
$$;

-- Live save of a managed tutor's profile: the same statements as the tutor's
-- own save and an approved revision. Photos must sit in the TUTOR's folder
-- (the admin upload route signs an upload into that folder). Visibility is not
-- part of it.
-- p_expected_updated_at is the tutor_profiles.updated_at the editor loaded (or
-- got back from its last save). The payload is the WHOLE profile, so a save
-- from a stale page would silently revert whatever was written since: another
-- admin's save, or an approved draft. Refused instead (hint stale_profile).
-- Null skips the check. Dropped first so a re-run cannot leave the two-
-- argument version beside this one.
drop function if exists public.admin_save_managed_tutor_profile(uuid, jsonb);

create or replace function public.admin_save_managed_tutor_profile(
  p_tutor_id            uuid,
  p_payload             jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name       text;
  v_profile    jsonb := coalesce(p_payload -> 'profile', '{}'::jsonb);
  v_avatar     text;
  v_banner     text;
  v_updated_at timestamptz;
  v_new_avatar text;
  v_new_banner text;
  v_before     jsonb;
  v_result     jsonb;
  v_changed    boolean;
begin
  perform public._require_admin();
  v_name := public._require_managed_tutor(p_tutor_id);

  select avatar_url, banner_url, updated_at into v_avatar, v_banner, v_updated_at
    from public.tutor_profiles where id = p_tutor_id;
  if p_expected_updated_at is not null and v_updated_at is distinct from p_expected_updated_at then
    raise exception 'This profile changed since you opened it. Reload the page to get the latest version, then save your change again.'
      using errcode = '22023', hint = 'stale_profile';
  end if;
  if not public._valid_profile_image(nullif(v_profile ->> 'avatar_url', ''), v_avatar, p_tutor_id)
     or not public._valid_profile_image(nullif(v_profile ->> 'banner_url', ''), v_banner, p_tutor_id) then
    raise exception 'That photo could not be saved. Please upload it again.'
      using errcode = '22023', hint = 'invalid_image_url';
  end if;

  v_before := public._tutor_snapshot(p_tutor_id);
  if p_payload ? 'full_name' then
    perform public._apply_tutor_name(p_tutor_id, p_payload ->> 'full_name');
  end if;
  v_result := public._apply_tutor_payload(p_tutor_id, p_payload, false);
  v_changed := public._tutor_snapshot(p_tutor_id) is distinct from v_before;

  -- The tutor's open draft is a full copy, and save_profile_draft (0072) only
  -- accepts the LIVE photo or a staged one. A photo the draft had not changed
  -- follows the new live one; otherwise every later draft save fails ("That
  -- photo could not be saved") and approving the draft puts the old one back.
  select avatar_url, banner_url into v_new_avatar, v_new_banner
    from public.tutor_profiles where id = p_tutor_id;
  if v_new_avatar is distinct from v_avatar or v_new_banner is distinct from v_banner then
    update public.tutor_profile_revisions
       set payload = jsonb_set(
                       jsonb_set(payload, '{profile,avatar_url}',
                         case when payload #>> '{profile,avatar_url}' is not distinct from v_avatar
                              then coalesce(to_jsonb(v_new_avatar), 'null'::jsonb)
                              else coalesce(payload #> '{profile,avatar_url}', 'null'::jsonb) end),
                       '{profile,banner_url}',
                       case when payload #>> '{profile,banner_url}' is not distinct from v_banner
                            then coalesce(to_jsonb(v_new_banner), 'null'::jsonb)
                            else coalesce(payload #> '{profile,banner_url}', 'null'::jsonb) end),
           updated_at = now()
     where tutor_id = p_tutor_id
       and status in ('draft', 'pending')
       and jsonb_typeof(payload -> 'profile') = 'object';
  end if;

  if v_changed then
    update public.tutor_profiles set admin_edited_at = now() where id = p_tutor_id;
    select full_name into v_name from public.profiles where id = p_tutor_id;
    perform public._log_admin_action('managed_profile_edited', 'tutor', p_tutor_id, v_name, null);
  end if;

  -- The new version, for the editor's next save.
  return v_result || jsonb_build_object(
    'changed', v_changed,
    'updated_at', (select updated_at from public.tutor_profiles where id = p_tutor_id)
  );
end;
$$;

create or replace function public.admin_set_managed_tutor_visibility(p_tutor_id uuid, p_visibility text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_old  text;
begin
  perform public._require_admin();
  if p_visibility is null or p_visibility not in ('public', 'hidden') then
    raise exception 'unknown visibility' using errcode = '22023';
  end if;
  v_name := public._require_managed_tutor(p_tutor_id);

  select visibility into v_old from public.tutor_profiles where id = p_tutor_id;
  if v_old = p_visibility then
    return jsonb_build_object('applied', false, 'visibility', v_old,
      'updated_at', (select updated_at from public.tutor_profiles where id = p_tutor_id));
  end if;
  update public.tutor_profiles set visibility = p_visibility, updated_at = now() where id = p_tutor_id;
  perform public._log_admin_action('managed_visibility_set', 'tutor', p_tutor_id, v_name, null,
                                   jsonb_build_object('visibility', p_visibility));
  -- updated_at moved: the editor adopts it so its next section save is not
  -- refused as stale (admin_save_managed_tutor_profile).
  return jsonb_build_object('applied', true, 'visibility', p_visibility,
    'updated_at', (select updated_at from public.tutor_profiles where id = p_tutor_id));
end;
$$;

-- Verified <-> none, no request needed.
create or replace function public.admin_set_tutor_verification(
  p_tutor_id uuid,
  p_verified boolean,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_old  text;
  v_new  text := case when coalesce(p_verified, false) then 'verified' else 'none' end;
begin
  perform public._require_admin();
  v_name := public._require_managed_tutor(p_tutor_id);

  select verification_status into v_old from public.tutor_profiles where id = p_tutor_id;
  if v_old = v_new then
    return jsonb_build_object('applied', false, 'status', v_old);
  end if;
  update public.tutor_profiles
     set verification_status = v_new, verification_requested_at = null
   where id = p_tutor_id;
  perform public._log_admin_action('verification_set', 'tutor', p_tutor_id, v_name, p_reason,
                                   jsonb_build_object('status', v_new));
  return jsonb_build_object('applied', true, 'status', v_new, 'notify_user_id', p_tutor_id,
                            'name', v_name, 'reason', public._clean_reason(p_reason));
end;
$$;

-- Dropped first so a re-run of this file cannot leave the one-argument version
-- beside this one (PostgREST could not choose between them).
drop function if exists public.admin_mark_managed_setup_done(uuid);

create or replace function public.admin_mark_managed_setup_done(p_tutor_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_done timestamptz;
begin
  perform public._require_admin();
  v_name := public._require_managed_tutor(p_tutor_id);
  select managed_setup_done_at into v_done from public.tutor_profiles where id = p_tutor_id;
  if v_done is not null then
    return jsonb_build_object('applied', false, 'status', 'done');
  end if;
  update public.tutor_profiles set managed_setup_done_at = now() where id = p_tutor_id;
  perform public._log_admin_action('managed_setup_done', 'tutor', p_tutor_id, v_name, p_reason);
  return jsonb_build_object('applied', true, 'status', 'done');
end;
$$;

-- Public documents of a managed tutor (0072 bodies, keyed on p_tutor_id). The
-- file is already in tutor-docs/<tutor_id>/ (the admin upload route signed the
-- upload). Each one also keeps the tutor's open draft in step: the draft is a
-- full copy, validated against live by save_profile_draft and applied whole on
-- approval.
create or replace function public.admin_add_managed_tutor_document(p_tutor_id uuid, p_path text, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_title text := btrim(coalesce(p_title, ''));
  v_doc   uuid;
begin
  perform public._require_admin();
  v_name := public._require_managed_tutor(p_tutor_id);
  if v_title = '' or length(v_title) > 200 then
    raise exception 'A document title is required (200 characters at most).' using errcode = '22023';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_tutor_id::text then
    raise exception 'invalid document path' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'tutor-docs' and name = p_path) then
    raise exception 'That file has not finished uploading.' using errcode = '22023';
  end if;
  if (select count(*) from public.tutor_documents where tutor_id = p_tutor_id) >= 5 then
    raise exception 'A tutor can have up to 5 documents.' using errcode = '22023';
  end if;

  insert into public.tutor_documents (tutor_id, storage_path, title)
  values (p_tutor_id, p_path, v_title)
  returning id into v_doc;
  -- The tutor's open draft is a full copy, and approving it deletes every live
  -- document it doesn't list (0072). Add this one so approval keeps it (unless
  -- the draft is already at the cap, where the stale-draft warning applies).
  update public.tutor_profile_revisions
     set payload = jsonb_set(payload, '{documents}',
                     coalesce(payload -> 'documents', '[]'::jsonb)
                       || jsonb_build_array(jsonb_build_object(
                            'id', v_doc, 'title', v_title, 'path', p_path, 'staged_path', null))),
         updated_at = now()
   where tutor_id = p_tutor_id
     and status in ('draft', 'pending')
     and jsonb_typeof(coalesce(payload -> 'documents', '[]'::jsonb)) = 'array'
     and jsonb_array_length(coalesce(payload -> 'documents', '[]'::jsonb)) < 5;
  update public.tutor_profiles set admin_edited_at = now() where id = p_tutor_id;
  perform public._log_admin_action('managed_document_changed', 'tutor', p_tutor_id, v_name, null,
                                   jsonb_build_object('op', 'add', 'title', v_title));
  return v_doc;
end;
$$;

create or replace function public.admin_rename_managed_tutor_document(p_tutor_id uuid, p_id uuid, p_title text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_title text := btrim(coalesce(p_title, ''));
  v_old   text;
begin
  perform public._require_admin();
  v_name := public._require_managed_tutor(p_tutor_id);
  if v_title = '' or length(v_title) > 200 then
    raise exception 'A document title is required (200 characters at most).' using errcode = '22023';
  end if;
  select title into v_old from public.tutor_documents where id = p_id and tutor_id = p_tutor_id for update;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if v_old is distinct from v_title then
    update public.tutor_documents set title = v_title where id = p_id;
    -- Carry the new title into the tutor's open draft where the draft still
    -- has the old one, so approving the draft doesn't rename it back.
    update public.tutor_profile_revisions
       set payload = jsonb_set(payload, '{documents}', (
             select coalesce(jsonb_agg(
                      case when d ->> 'id' = p_id::text and (d ->> 'title') is not distinct from v_old
                           then jsonb_set(d, '{title}', to_jsonb(v_title))
                           else d end
                      order by ord), '[]'::jsonb)
               from jsonb_array_elements(payload -> 'documents') with ordinality as e(d, ord))),
           updated_at = now()
     where tutor_id = p_tutor_id
       and status in ('draft', 'pending')
       and jsonb_typeof(payload -> 'documents') = 'array';
    update public.tutor_profiles set admin_edited_at = now() where id = p_tutor_id;
    perform public._log_admin_action('managed_document_changed', 'tutor', p_tutor_id, v_name, null,
                                     jsonb_build_object('op', 'rename', 'title', v_title));
  end if;
  return v_title;
end;
$$;

create or replace function public.admin_delete_managed_tutor_document(p_tutor_id uuid, p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_path  text;
  v_title text;
begin
  perform public._require_admin();
  v_name := public._require_managed_tutor(p_tutor_id);
  delete from public.tutor_documents where id = p_id and tutor_id = p_tutor_id
  returning storage_path, title into v_path, v_title;
  if v_path is null then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  -- Drop it from the tutor's open draft too: save_profile_draft (0072) refuses
  -- a document id that no longer exists, so a stale one blocks every draft save.
  update public.tutor_profile_revisions
     set payload = jsonb_set(payload, '{documents}', (
           select coalesce(jsonb_agg(d order by ord), '[]'::jsonb)
             from jsonb_array_elements(payload -> 'documents') with ordinality as e(d, ord)
            where coalesce(d ->> 'id', '') <> p_id::text)),
         updated_at = now()
   where tutor_id = p_tutor_id
     and status in ('draft', 'pending')
     and jsonb_typeof(payload -> 'documents') = 'array';
  update public.tutor_profiles set admin_edited_at = now() where id = p_tutor_id;
  perform public._log_admin_action('managed_document_changed', 'tutor', p_tutor_id, v_name, null,
                                   jsonb_build_object('op', 'delete', 'title', v_title));
  return v_path;
end;
$$;

-- 7. History + counts ------------------------------------------------------------
alter table public.admin_actions drop constraint if exists admin_actions_action_check;
alter table public.admin_actions add constraint admin_actions_action_check check (action in (
  'verification_approved', 'verification_rejected',
  'review_approved', 'review_rejected',
  'report_disable_reported', 'report_disable_reporter',
  'report_dismiss', 'report_remove_review',
  'revision_approved', 'revision_rejected',
  'account_disabled', 'account_enabled',
  'author_granted', 'author_revoked',
  'company_invited', 'company_link_issued',
  'company_hidden', 'company_shown', 'company_deleted',
  'tutor_invite_rotated', 'managed_profile_edited', 'managed_visibility_set',
  'managed_document_changed', 'verification_set', 'managed_setup_done'
));

create or replace function public.admin_pending_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'verifications', (select count(*) from public.tutor_profiles where verification_status = 'pending'),
    'reviews',       (select count(*) from public.reviews where status = 'pending'),
    'reports',       (select count(*) from public.reports where status = 'pending'),
    'revisions',     (select count(*) from public.tutor_profile_revisions where status = 'pending'),
    'invites',       (select count(*) from public.tutor_profiles
                       where managed_at is not null and managed_setup_done_at is null)
  );
end;
$$;

-- Grants -------------------------------------------------------------------------
revoke all     on function public.admin_get_tutor_invite_key()                              from public, anon;
revoke all     on function public.admin_rotate_tutor_invite_key()                           from public, anon;
revoke all     on function public.admin_save_managed_tutor_profile(uuid, jsonb, timestamptz) from public, anon;
revoke all     on function public.admin_set_managed_tutor_visibility(uuid, text)            from public, anon;
revoke all     on function public.admin_set_tutor_verification(uuid, boolean, text)         from public, anon;
revoke all     on function public.admin_mark_managed_setup_done(uuid, text)                 from public, anon;
revoke all     on function public.admin_add_managed_tutor_document(uuid, text, text)        from public, anon;
revoke all     on function public.admin_rename_managed_tutor_document(uuid, uuid, text)     from public, anon;
revoke all     on function public.admin_delete_managed_tutor_document(uuid, uuid)           from public, anon;
revoke all     on function public.admin_pending_counts()                                    from public, anon;

grant  execute on function public.admin_get_tutor_invite_key()                              to authenticated;
grant  execute on function public.admin_rotate_tutor_invite_key()                           to authenticated;
grant  execute on function public.admin_save_managed_tutor_profile(uuid, jsonb, timestamptz) to authenticated;
grant  execute on function public.admin_set_managed_tutor_visibility(uuid, text)            to authenticated;
grant  execute on function public.admin_set_tutor_verification(uuid, boolean, text)         to authenticated;
grant  execute on function public.admin_mark_managed_setup_done(uuid, text)                 to authenticated;
grant  execute on function public.admin_add_managed_tutor_document(uuid, text, text)        to authenticated;
grant  execute on function public.admin_rename_managed_tutor_document(uuid, uuid, text)     to authenticated;
grant  execute on function public.admin_delete_managed_tutor_document(uuid, uuid)           to authenticated;
grant  execute on function public.admin_pending_counts()                                    to authenticated;
