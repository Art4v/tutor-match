-- ============================================================================
-- tutormatch — 0081: managed becomes a setup stage that ends in verification
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0080 (in order).
--
-- DEPLOY ORDER: 0081 -> app -> 0082. This file is additive: the three RPCs the
--   previous app calls (admin_set_tutor_verification,
--   admin_set_managed_tutor_visibility, admin_mark_managed_setup_done) and
--   tutor_profiles.managed_setup_done_at stay until 0082. No function in this
--   file reads or writes that column, so 0082 can drop it without re-creating
--   them.
--
-- THE MODEL:
--   0076 made "managed" open-ended: admins edited a tutor's live profile for
--   as long as they liked and could verify or publish it without the tutor
--   ever seeing the result. Management is now a one-off SETUP STAGE:
--
--     redeem -> setup -> sent -> approved -> (Verify tutor) -> released
--                 ^        |  \-> changes_requested -> sent ...
--                 \-Recall-/  (Recall also from approved)
--
--   * setup / changes_requested: an admin edits the (hidden) live profile.
--   * sent: the tutor has been emailed. They approve, or request changes with
--     a note, signed in on their own profile. The admin editor is LOCKED.
--   * approved: an admin may press Verify tutor. Still locked; Recall returns
--     to setup and cancels the approval.
--   * Verify tutor: verified + public + managed_at cleared, in one transaction.
--     From then on the tutor is an ordinary verified tutor (0072 drafts).
--   The tutor's approval is a hard requirement: admin_verify_managed_tutor is
--   the only way a managed tutor reaches verified or public (once 0082 has
--   dropped the 0076 toggles), and it applies only from `approved`.
--
--   While managed the tutor's profile is READ-ONLY for them: no drafts. Their
--   one input besides approve / request changes is a private note they can
--   rewrite at any time.
--
--   Stage, timestamps and both notes live in tutor_managed_setup, which has no
--   client policies. They cannot be columns of tutor_profiles: that table is
--   publicly readable. tutor_profiles.managed_at stays the "is managed" flag.
--   A managed tutor with no row reads as `setup`.
--
--   Tutors managed under 0076 are split by whether an admin had FINISHED with
--   them: marked set up (managed_setup_done_at, the old "Mark set up" button)
--   AND verified.
--   * finished: released here, keeping their verification and visibility. They
--     become ordinary verified tutors (0072 reviewed drafts).
--   * everyone else: stays managed and enters the new flow at `setup`. Their
--     profile is hidden, verification goes back to none (a verified badge an
--     admin gave before setup was finished included, and a pending request),
--     and any open draft is withdrawn, so they reach verified and public only
--     through their own approval and Verify tutor. Their signup materials are
--     kept.
--   The released tutors' private signup files, and the staged files of every
--   withdrawn draft, are removed afterwards by
--   scripts/sweep-released-materials.mjs (Storage cannot be deleted from SQL).
--
--   Quick join now refuses a VERIFIED tutor (hint already_verified), and
--   withdraws a pending verification request on opt in.
-- ============================================================================

begin;

-- 1. The setup row -------------------------------------------------------------
create table if not exists public.tutor_managed_setup (
  tutor_id              uuid primary key references public.tutor_profiles(id) on delete cascade,
  stage                 text not null default 'setup'
                          check (stage in ('setup', 'sent', 'changes_requested', 'approved')),
  sent_at               timestamptz,
  emailed_at            timestamptz,
  sent_by               uuid references public.profiles(id) on delete set null,
  admin_message         text check (admin_message is null or char_length(admin_message) <= 500),
  responded_at          timestamptz,
  change_note           text check (change_note is null or char_length(change_note) <= 500),
  tutor_note            text check (tutor_note is null or char_length(tutor_note) <= 2000),
  tutor_note_updated_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.tutor_managed_setup enable row level security;
-- No policies: the tutor reads through get_my_managed_setup, admins through
-- the service role, and every write is one of the RPCs below.

-- 2. The tutors managed under 0076 ----------------------------------------------
-- Every statement here is limited to managed tutors with NO setup row, so a
-- re-run of this file never touches a tutor already in the new flow
-- (redeem_tutor_invite and 2c always create a row).

-- "Finished" below = verified AND marked set up under the old flow.

-- 2a. A tutor who is not finished keeps being managed, and a managed tutor has
-- no drafts (section 3). Withdraw the open one, or it could still be submitted
-- and approved onto the profile behind the edit lock. A finished tutor keeps
-- theirs: they are released below and stay gated by verification.
update public.tutor_profile_revisions r
   set status = 'withdrawn', decided_at = now(), updated_at = now()
  from public.tutor_profiles t
 where t.id = r.tutor_id
   and t.managed_at is not null
   and not (t.verification_status = 'verified' and t.managed_setup_done_at is not null)
   and r.status in ('draft', 'pending')
   and not exists (select 1 from public.tutor_managed_setup s where s.tutor_id = t.id);

-- 2b. Finished: released as they are.
update public.tutor_profiles t
   set managed_at = null,
       managed_setup_done_at = null,
       invite_materials_submitted_at = null
 where t.managed_at is not null
   and t.verification_status = 'verified'
   and t.managed_setup_done_at is not null
   and not exists (select 1 from public.tutor_managed_setup s where s.tutor_id = t.id);

-- 2c. Everyone else enters the new flow at `setup`: hidden and unverified, the
-- state redeem_tutor_invite leaves a new joiner in. That takes back a verified
-- badge given before setup was finished; Verify tutor gives it again once the
-- tutor has approved. The profile update runs first: once the row exists, this
-- block skips them.
update public.tutor_profiles t
   set visibility = 'hidden',
       verification_status = case when verification_status in ('verified', 'pending') then 'none' else verification_status end,
       verification_requested_at = null
 where t.managed_at is not null
   and t.partner_id is null
   and not exists (select 1 from public.tutor_managed_setup s where s.tutor_id = t.id);

insert into public.tutor_managed_setup (tutor_id)
select t.id
  from public.tutor_profiles t
 where t.managed_at is not null
   and t.partner_id is null
on conflict (tutor_id) do nothing;

-- 3. A managed tutor has no drafts ---------------------------------------------
-- save_profile_draft (0072) lets any gated tutor open a draft, and a managed
-- tutor is gated. Refused at the table, so every write path is covered and the
-- 0072 body needs no copy. Nobody managed holds an open draft: only an
-- unverified tutor can opt in, and 2a closed the ones from before.
create or replace function public.tutor_profile_revisions_refuse_managed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.tutor_profiles where id = new.tutor_id and managed_at is not null) then
    raise exception 'MatchTutor is setting up your profile, so it can''t be edited yet.'
      using errcode = '42501', hint = 'managed_by_admin';
  end if;
  return new;
end;
$$;

revoke all on function public.tutor_profile_revisions_refuse_managed() from public, anon, authenticated;

drop trigger if exists tutor_profile_revisions_refuse_managed on public.tutor_profile_revisions;
create trigger tutor_profile_revisions_refuse_managed
  before insert on public.tutor_profile_revisions
  for each row execute function public.tutor_profile_revisions_refuse_managed();

-- 4. Joining --------------------------------------------------------------------
-- 0077's body, plus: a verified tutor is refused, a pending verification
-- request is withdrawn, and the setup row is created.
create or replace function public.redeem_tutor_invite(p_user_id uuid)
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
  v_verification text;
  v_confirmed_at timestamptz;
  v_created      boolean := false;
begin
  if p_user_id is null then
    raise exception 'no account' using errcode = '22023';
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
    raise exception 'Admin accounts cannot be managed.' using errcode = '22023', hint = 'admin_account';
  end if;

  if v_role is null then
    update public.profiles set role = 'tutor' where id = p_user_id;
    select email_confirmed_at into v_confirmed_at from auth.users where id = p_user_id;
    insert into public.tutor_profiles (id, slug, email_confirmed_at, visibility, onboarded)
    values (p_user_id, p_user_id::text, v_confirmed_at, 'hidden', true);
    perform public._assign_tutor_slug(p_user_id, v_name);
    v_created := true;
  elsif v_role <> 'tutor' then
    raise exception 'Only tutor accounts can be managed.' using errcode = '22023', hint = 'wrong_role';
  end if;

  select partner_id, managed_at, verification_status into v_partner, v_managed, v_verification
    from public.tutor_profiles where id = p_user_id for update;
  if v_partner is not null then
    raise exception 'Only tutor accounts can be managed.' using errcode = '22023', hint = 'wrong_role';
  end if;
  if v_managed is not null then
    return jsonb_build_object('created', false, 'already', true, 'name', v_name);
  end if;
  if v_verification = 'verified' then
    raise exception 'Quick join is for tutors who are not verified yet.'
      using errcode = '22023', hint = 'already_verified';
  end if;

  -- A pending request leaves the Verification queue: Verify tutor, at the end
  -- of setup, is the only way a managed tutor is verified.
  update public.tutor_profiles
     set managed_at = now(),
         invite_materials_submitted_at = null,
         onboarded = true,
         visibility = 'hidden',
         verification_status = case when verification_status = 'pending' then 'none' else verification_status end,
         verification_requested_at = null
   where id = p_user_id;

  insert into public.tutor_managed_setup (tutor_id) values (p_user_id)
  on conflict (tutor_id) do update
    set stage = 'setup', sent_at = null, emailed_at = null, sent_by = null, admin_message = null,
        responded_at = null, change_note = null, updated_at = now();

  return jsonb_build_object('created', v_created, 'already', false, 'name', v_name);
end;
$$;

revoke all     on function public.redeem_tutor_invite(uuid) from public, anon, authenticated;
grant  execute on function public.redeem_tutor_invite(uuid) to service_role;

-- 5. Tutor RPCs -----------------------------------------------------------------

-- The caller's own setup state, or NULL when they are not managed.
create or replace function public.get_my_managed_setup()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'stage', coalesce(s.stage, 'setup'),
           'sent_at', s.sent_at,
           'admin_message', s.admin_message,
           'change_note', s.change_note,
           'tutor_note', s.tutor_note)
    from public.tutor_profiles t
    left join public.tutor_managed_setup s on s.tutor_id = t.id
   where t.id = auth.uid() and t.managed_at is not null;
$$;

-- The tutor's one editable note for the team. Empty clears it. Returns whether
-- it changed, so the route alerts the admins only for a real change.
create or replace function public.save_managed_note(p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := public._require_own_tutor();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_old  text;
begin
  perform 1 from public.tutor_profiles where id = v_id and managed_at is not null for update;
  if not found then
    raise exception 'Your profile is not managed by MatchTutor.' using errcode = '22023', hint = 'not_managed';
  end if;
  if char_length(v_note) > 2000 then
    raise exception 'Your note can be 2000 characters at most.' using errcode = '22023';
  end if;

  select tutor_note into v_old from public.tutor_managed_setup where tutor_id = v_id;
  if v_old is not distinct from v_note then
    return jsonb_build_object('changed', false, 'note', v_note);
  end if;

  insert into public.tutor_managed_setup (tutor_id, tutor_note, tutor_note_updated_at)
  values (v_id, v_note, now())
  on conflict (tutor_id) do update
    set tutor_note = excluded.tutor_note, tutor_note_updated_at = now(), updated_at = now();

  return jsonb_build_object('changed', true, 'note', v_note);
end;
$$;

-- Approve the profile, or ask for changes with a note. Only while it is with
-- the tutor (`sent`): a Recall or an earlier answer makes this a no-op that
-- reports the current stage.
create or replace function public.respond_managed_setup(p_approve boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := public._require_own_tutor();
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
  v_stage text;
begin
  perform 1 from public.tutor_profiles where id = v_id and managed_at is not null for update;
  if not found then
    raise exception 'Your profile is not managed by MatchTutor.' using errcode = '22023', hint = 'not_managed';
  end if;
  if p_approve is null then
    raise exception 'invalid response' using errcode = '22023';
  end if;
  if not p_approve and v_note is null then
    raise exception 'Tell us what to change.' using errcode = '22023';
  end if;
  if char_length(v_note) > 500 then
    raise exception 'Your note can be 500 characters at most.' using errcode = '22023';
  end if;

  select stage into v_stage from public.tutor_managed_setup where tutor_id = v_id for update;
  v_stage := coalesce(v_stage, 'setup');
  if v_stage <> 'sent' then
    return jsonb_build_object('applied', false, 'stage', v_stage);
  end if;

  update public.tutor_managed_setup
     set stage = case when p_approve then 'approved' else 'changes_requested' end,
         responded_at = now(),
         change_note = case when p_approve then null else v_note end,
         updated_at = now()
   where tutor_id = v_id;

  return jsonb_build_object(
    'applied', true,
    'stage', case when p_approve then 'approved' else 'changes_requested' end,
    'note', case when p_approve then null else v_note end,
    'name', (select full_name from public.profiles where id = v_id));
end;
$$;

-- 0076's submit, plus the optional note. The two-argument version stays as a
-- wrapper for the previous app; 0082 drops it.
create or replace function public.submit_invite_materials(p_docs jsonb, p_links jsonb, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := public._require_own_tutor();
  v_docs  jsonb := coalesce(p_docs, '[]'::jsonb);
  v_links jsonb := coalesce(p_links, '[]'::jsonb);
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
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
  if char_length(v_note) > 2000 then
    raise exception 'Your note can be 2000 characters at most.' using errcode = '22023';
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

  if v_note is not null then
    insert into public.tutor_managed_setup (tutor_id, tutor_note, tutor_note_updated_at)
    values (v_id, v_note, now())
    on conflict (tutor_id) do update
      set tutor_note = excluded.tutor_note, tutor_note_updated_at = now(), updated_at = now();
  end if;

  update public.tutor_profiles set invite_materials_submitted_at = now() where id = v_id;
end;
$$;

create or replace function public.submit_invite_materials(p_docs jsonb, p_links jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  select public.submit_invite_materials(p_docs, p_links, null::text);
$$;

-- 0076's opt out, which now also removes the setup row (stage and both notes).
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
  delete from public.tutor_managed_setup where tutor_id = v_id;

  update public.tutor_profiles
     set managed_at = null,
         invite_materials_submitted_at = null,
         verification_status = 'none',
         verification_requested_at = null
   where id = v_id;

  return jsonb_build_object('materials', to_jsonb(v_paths), 'staged', to_jsonb(v_staged));
end;
$$;

-- 6. Admin RPCs -----------------------------------------------------------------

-- Admins edit only while the profile is with them. Raised after
-- _require_managed_tutor, which holds the tutor row lock.
create or replace function public._assert_managed_editable(p_tutor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage text;
begin
  select stage into v_stage from public.tutor_managed_setup where tutor_id = p_tutor_id;
  if coalesce(v_stage, 'setup') not in ('setup', 'changes_requested') then
    raise exception 'This profile is with the tutor. Recall it before you edit.'
      using errcode = '42501', hint = 'setup_locked';
  end if;
end;
$$;

revoke all on function public._assert_managed_editable(uuid) from public, anon, authenticated;

-- Send the profile to the tutor for approval, with an optional message. The
-- route emails them. A send clears the change request it answers.
create or replace function public.admin_send_managed_setup(p_tutor_id uuid, p_message text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text;
  v_stage   text;
  v_message text := public._clean_reason(p_message);
begin
  perform public._require_admin();
  v_name := public._require_managed_tutor(p_tutor_id);

  select stage into v_stage from public.tutor_managed_setup where tutor_id = p_tutor_id for update;
  v_stage := coalesce(v_stage, 'setup');
  if v_stage not in ('setup', 'changes_requested') then
    return jsonb_build_object('applied', false, 'status', v_stage);
  end if;

  insert into public.tutor_managed_setup (tutor_id, stage, sent_at, emailed_at, sent_by, admin_message)
  values (p_tutor_id, 'sent', now(), now(), auth.uid(), v_message)
  on conflict (tutor_id) do update
    set stage = 'sent', sent_at = now(), emailed_at = now(), sent_by = auth.uid(),
        admin_message = excluded.admin_message, responded_at = null, change_note = null,
        updated_at = now();

  perform public._log_admin_action('managed_setup_sent', 'tutor', p_tutor_id, v_name, v_message);
  return jsonb_build_object('applied', true, 'status', 'sent', 'name', v_name, 'message', v_message);
end;
$$;

-- Email the tutor again while their answer is outstanding.
create or replace function public.admin_resend_managed_setup(p_tutor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text;
  v_stage   text;
  v_message text;
begin
  perform public._require_admin();
  v_name := public._require_managed_tutor(p_tutor_id);

  select stage, admin_message into v_stage, v_message
    from public.tutor_managed_setup where tutor_id = p_tutor_id for update;
  v_stage := coalesce(v_stage, 'setup');
  if v_stage <> 'sent' then
    return jsonb_build_object('applied', false, 'status', v_stage);
  end if;

  update public.tutor_managed_setup set emailed_at = now(), updated_at = now() where tutor_id = p_tutor_id;
  perform public._log_admin_action('managed_setup_resent', 'tutor', p_tutor_id, v_name, null);
  return jsonb_build_object('applied', true, 'status', 'sent', 'name', v_name, 'message', v_message);
end;
$$;

-- Take the profile back to edit it. Cancels an approval already given.
create or replace function public.admin_recall_managed_setup(p_tutor_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_stage text;
begin
  perform public._require_admin();
  v_name := public._require_managed_tutor(p_tutor_id);

  select stage into v_stage from public.tutor_managed_setup where tutor_id = p_tutor_id for update;
  v_stage := coalesce(v_stage, 'setup');
  if v_stage not in ('sent', 'approved') then
    return jsonb_build_object('applied', false, 'status', v_stage);
  end if;

  update public.tutor_managed_setup
     set stage = 'setup', responded_at = null, updated_at = now()
   where tutor_id = p_tutor_id;

  perform public._log_admin_action('managed_setup_recalled', 'tutor', p_tutor_id, v_name, p_reason,
                                   jsonb_build_object('from', v_stage));
  return jsonb_build_object('applied', true, 'status', 'setup', 'name', v_name,
                            'reason', public._clean_reason(p_reason));
end;
$$;

-- Verify tutor: the end of setup. Only from `approved`, so what is verified is
-- exactly what the tutor approved (the editor is locked from `sent` onwards).
-- Verified + public + released in one transaction. Returns the private
-- materials' paths for the route to delete from Storage.
create or replace function public.admin_verify_managed_tutor(p_tutor_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name      text;
  v_stage     text;
  v_approved  timestamptz;
  v_confirmed timestamptz;
  v_slug      text;
  v_paths     text[];
begin
  perform public._require_admin();
  v_name := public._require_managed_tutor(p_tutor_id);

  select stage, responded_at into v_stage, v_approved
    from public.tutor_managed_setup where tutor_id = p_tutor_id for update;
  v_stage := coalesce(v_stage, 'setup');
  if v_stage <> 'approved' then
    return jsonb_build_object('applied', false, 'status', v_stage);
  end if;

  select email_confirmed_at, slug into v_confirmed, v_slug
    from public.tutor_profiles where id = p_tutor_id;
  if v_confirmed is null then
    raise exception 'this tutor has not confirmed their email yet' using errcode = '22023';
  end if;

  with gone as (
    delete from public.tutor_invite_materials
     where tutor_id = p_tutor_id and kind = 'document'
    returning storage_path
  )
  select coalesce(array_agg(storage_path), '{}'::text[]) into v_paths from gone;
  delete from public.tutor_invite_materials where tutor_id = p_tutor_id;
  delete from public.tutor_managed_setup where tutor_id = p_tutor_id;

  update public.tutor_profiles
     set verification_status = 'verified',
         verification_requested_at = null,
         visibility = 'public',
         managed_at = null,
         invite_materials_submitted_at = null,
         updated_at = now()
   where id = p_tutor_id;

  perform public._log_admin_action('managed_tutor_verified', 'tutor', p_tutor_id, v_name, p_reason,
                                   jsonb_build_object('approved_at', v_approved));
  return jsonb_build_object('applied', true, 'status', 'verified', 'name', v_name, 'slug', v_slug,
                            'reason', public._clean_reason(p_reason), 'materials', to_jsonb(v_paths));
end;
$$;

-- The four edit RPCs: 0076's bodies plus the edit lock. The code that kept the
-- tutor's open draft in step is gone, since a managed tutor no longer has one.
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
  v_before     jsonb;
  v_result     jsonb;
  v_changed    boolean;
begin
  perform public._require_admin();
  v_name := public._require_managed_tutor(p_tutor_id);
  perform public._assert_managed_editable(p_tutor_id);

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

  if v_changed then
    update public.tutor_profiles set admin_edited_at = now() where id = p_tutor_id;
    select full_name into v_name from public.profiles where id = p_tutor_id;
    perform public._log_admin_action('managed_profile_edited', 'tutor', p_tutor_id, v_name, null);
  end if;

  return v_result || jsonb_build_object(
    'changed', v_changed,
    'updated_at', (select updated_at from public.tutor_profiles where id = p_tutor_id)
  );
end;
$$;

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
  perform public._assert_managed_editable(p_tutor_id);
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
  perform public._assert_managed_editable(p_tutor_id);
  if v_title = '' or length(v_title) > 200 then
    raise exception 'A document title is required (200 characters at most).' using errcode = '22023';
  end if;
  select title into v_old from public.tutor_documents where id = p_id and tutor_id = p_tutor_id for update;
  if not found then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if v_old is distinct from v_title then
    update public.tutor_documents set title = v_title where id = p_id;
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
  perform public._assert_managed_editable(p_tutor_id);
  delete from public.tutor_documents where id = p_id and tutor_id = p_tutor_id
  returning storage_path, title into v_path, v_title;
  if v_path is null then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  update public.tutor_profiles set admin_edited_at = now() where id = p_tutor_id;
  perform public._log_admin_action('managed_document_changed', 'tutor', p_tutor_id, v_name, null,
                                   jsonb_build_object('op', 'delete', 'title', v_title));
  return v_path;
end;
$$;

-- 7. History + counts -----------------------------------------------------------
-- The retired actions stay for the History rows that already have them.
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
  'managed_document_changed', 'verification_set', 'managed_setup_done',
  'managed_setup_sent', 'managed_setup_resent', 'managed_setup_recalled', 'managed_tutor_verified'
));

-- `invites` is now every managed tutor: management is the queue.
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
                       where managed_at is not null and partner_id is null)
  );
end;
$$;

-- Grants ------------------------------------------------------------------------
revoke all     on function public.get_my_managed_setup()                       from public, anon;
revoke all     on function public.save_managed_note(text)                      from public, anon;
revoke all     on function public.respond_managed_setup(boolean, text)         from public, anon;
revoke all     on function public.submit_invite_materials(jsonb, jsonb, text)  from public, anon;
revoke all     on function public.submit_invite_materials(jsonb, jsonb)        from public, anon;
revoke all     on function public.opt_out_of_management()                      from public, anon;
revoke all     on function public.admin_send_managed_setup(uuid, text)         from public, anon;
revoke all     on function public.admin_resend_managed_setup(uuid)             from public, anon;
revoke all     on function public.admin_recall_managed_setup(uuid, text)       from public, anon;
revoke all     on function public.admin_verify_managed_tutor(uuid, text)       from public, anon;

grant  execute on function public.get_my_managed_setup()                       to authenticated;
grant  execute on function public.save_managed_note(text)                      to authenticated;
grant  execute on function public.respond_managed_setup(boolean, text)         to authenticated;
grant  execute on function public.submit_invite_materials(jsonb, jsonb, text)  to authenticated;
grant  execute on function public.submit_invite_materials(jsonb, jsonb)        to authenticated;
grant  execute on function public.opt_out_of_management()                      to authenticated;
grant  execute on function public.admin_send_managed_setup(uuid, text)         to authenticated;
grant  execute on function public.admin_resend_managed_setup(uuid)             to authenticated;
grant  execute on function public.admin_recall_managed_setup(uuid, text)       to authenticated;
grant  execute on function public.admin_verify_managed_tutor(uuid, text)       to authenticated;

commit;
