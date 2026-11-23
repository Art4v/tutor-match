-- ============================================================================
-- tutormatch — 0083: the "marks verified" seal
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0082 (in order).
--
-- DEPLOY ORDER: 0083 -> app -> node scripts/notify-marks-seal.mjs --apply.
--   Additive and safe with the previous app: it never reads marks_status, and
--   admin_decide_verification still accepts 'approve' and 'reject' unchanged.
--
-- WHAT THIS IS:
--   verification_status = 'verified' keeps meaning "approved to be listed".
--   A second, independent fact sits beside it: whether MatchTutor can fully
--   support the tutor's marks. That is tutor_profiles.marks_status, and
--   'verified' there is the seal. A separate column rather than a new
--   verification_status value because an approved tutor must stay listed while
--   an upgrade request is pending, and because everything that reads 'verified'
--   today (listing, reviewed edits, document purge, managed setup) keeps its
--   meaning with no edit.
--
--   Every existing tutor starts at the default 'none', which IS the migration:
--   nobody holds the seal until an admin grants it.
--
-- WHO CAN HOLD IT: an approved, non-company tutor, and nobody else. That is the
--   CHECK below, so it holds for every writer. A trigger clears the seal (and
--   any pending request) the moment a tutor stops being verified.
--
-- WAYS TO THE SEAL:
--   * admin_decide_verification(.., 'approve_marks'): approval and seal at once.
--   * request_marks_verification() -> admin_decide_marks(): the tutor asks,
--     with private supporting documents (0079), and an admin grants or declines.
--   * admin_set_marks(): an admin grants or revokes directly, no request needed.
--   Managed setup's admin_verify_managed_tutor never grants it.
-- ============================================================================

begin;

-- 1. Columns --------------------------------------------------------------------
alter table public.tutor_profiles
  add column if not exists marks_status text not null default 'none',
  add column if not exists marks_requested_at timestamptz;

alter table public.tutor_profiles drop constraint if exists tutor_profiles_marks_status_check;
alter table public.tutor_profiles add constraint tutor_profiles_marks_status_check
  check (marks_status in ('none', 'pending', 'verified', 'declined'));

alter table public.tutor_profiles drop constraint if exists tutor_profiles_marks_needs_approval;
alter table public.tutor_profiles add constraint tutor_profiles_marks_needs_approval check (
  marks_status = 'none'
  or (verification_status = 'verified' and partner_id is null)
);

-- The seal-only browse filter and the admin queue.
create index if not exists tutor_profiles_marks_status_idx
  on public.tutor_profiles (marks_status) where marks_status <> 'none';

-- 2. Losing approval clears the seal ---------------------------------------------
-- BEFORE, so the row satisfies tutor_profiles_marks_needs_approval whichever
-- writer moved verification_status (an RPC, a SQL utility, the dashboard).
create or replace function public.tutor_profiles_clear_marks()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.verification_status is distinct from 'verified' or new.partner_id is not null then
    new.marks_status := 'none';
    new.marks_requested_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.tutor_profiles_clear_marks() from public, anon, authenticated;

-- Named to sort before tutor_profiles_guard_derived: triggers fire in name
-- order, and the guard must compare the value this one settled on.
drop trigger if exists tutor_profiles_clear_marks on public.tutor_profiles;
create trigger tutor_profiles_clear_marks
  before update of verification_status, partner_id on public.tutor_profiles
  for each row
  execute function public.tutor_profiles_clear_marks();

-- 3. Clients cannot write either column ------------------------------------------
-- 0082's guard plus the two new system columns.
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
    if new.marks_status is distinct from old.marks_status then
      raise exception 'protected_column:marks_status' using errcode = '42501';
    end if;
    if new.marks_requested_at is distinct from old.marks_requested_at then
      raise exception 'protected_column:marks_requested_at' using errcode = '42501';
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

-- 0076's snapshot minus the two new columns, so a seal request or decision is
-- never mistaken for a profile change.
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
      'managed_at', 'managed_setup_done_at', 'invite_materials_submitted_at', 'admin_edited_at',
      'marks_status', 'marks_requested_at'
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

-- 4. Private supporting documents (0079) -----------------------------------------
-- An approved tutor may attach files again, for a seal request. Same rules one
-- level up: editable while there is no open request, locked while one is under
-- review, refused once the seal is held.
create or replace function public._lock_verification_docs_editable(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status  text;
  v_marks   text;
  v_managed timestamptz;
  v_partner uuid;
  v_account text;
begin
  if p_id is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  select t.verification_status, t.marks_status, t.managed_at, t.partner_id, p.status
    into v_status, v_marks, v_managed, v_partner, v_account
    from public.tutor_profiles t join public.profiles p on p.id = t.id
   where t.id = p_id
   for update of t;

  if not found then
    raise exception 'No tutor profile.' using errcode = '22023';
  end if;
  if v_account <> 'enabled' then
    raise exception 'Your account is disabled.' using errcode = '22023';
  end if;
  if v_managed is not null or v_partner is not null then
    raise exception 'This profile is managed, so documents can''t be changed here.' using errcode = '22023';
  end if;
  if v_status = 'pending' or (v_status = 'verified' and v_marks = 'pending') then
    raise exception 'Your documents are locked while your request is under review.' using errcode = '22023';
  end if;
  if v_status = 'verified' and v_marks = 'verified' then
    raise exception 'Your marks are already verified.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public._lock_verification_docs_editable(uuid) from public, anon, authenticated;

-- Reaching the seal by ANY path flags the files, exactly as reaching verified
-- does (0079). Approval without the seal still flags them through 0079's
-- trigger, so a later seal request starts from fresh uploads.
drop trigger if exists tutor_profiles_flag_marks_docs on public.tutor_profiles;
create trigger tutor_profiles_flag_marks_docs
  after update of marks_status on public.tutor_profiles
  for each row
  when (new.marks_status = 'verified' and old.marks_status is distinct from 'verified')
  execute function public.tutor_profiles_flag_verification_docs();

-- 5. Tutor RPCs ------------------------------------------------------------------
-- none/declined -> pending. Returns the resulting status unchanged otherwise, so
-- a double click does not alert the admins twice (the route compares).
create or replace function public.request_marks_verification()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid := auth.uid();
  v_status  text;
  v_marks   text;
  v_managed timestamptz;
  v_partner uuid;
  v_account text;
begin
  if v_id is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  select t.verification_status, t.marks_status, t.managed_at, t.partner_id, p.status
    into v_status, v_marks, v_managed, v_partner, v_account
    from public.tutor_profiles t join public.profiles p on p.id = t.id
   where t.id = v_id
   for update of t;

  if not found then
    raise exception 'No tutor profile.' using errcode = '22023';
  end if;
  if v_account <> 'enabled' then
    raise exception 'Your account is disabled.' using errcode = '22023';
  end if;
  if v_status <> 'verified' or v_managed is not null or v_partner is not null then
    raise exception 'Get verified first, then you can ask for the marks verified seal.'
      using errcode = '22023', hint = 'not_verified';
  end if;

  if v_marks in ('none', 'declined') then
    update public.tutor_profiles
       set marks_status = 'pending', marks_requested_at = now()
     where id = v_id;
    v_marks := 'pending';
  end if;

  return v_marks;
end;
$$;

-- pending -> none. The files stay, unlocked, for the next request.
create or replace function public.withdraw_marks_request()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := auth.uid();
  v_marks text;
begin
  if v_id is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  select marks_status into v_marks
    from public.tutor_profiles where id = v_id
    for update;
  if not found then
    raise exception 'No tutor profile.' using errcode = '22023';
  end if;

  if v_marks = 'pending' then
    update public.tutor_profiles
       set marks_status = 'none', marks_requested_at = null
     where id = v_id;
    v_marks := 'none';
  end if;

  return v_marks;
end;
$$;

-- 6. Admin RPCs ------------------------------------------------------------------
-- 0074's decision plus 'approve_marks': approved and sealed in one UPDATE.
create or replace function public.admin_decide_verification(
  p_tutor_id uuid,
  p_decision text,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new     text;
  v_marks   boolean;
  v_status  text;
  v_name    text;
  v_slug    text;
  v_partner uuid;
begin
  perform public._require_admin();
  if p_decision not in ('approve', 'approve_marks', 'reject') then
    raise exception 'unknown decision' using errcode = '22023';
  end if;
  v_new   := case when p_decision = 'reject' then 'rejected' else 'verified' end;
  v_marks := p_decision = 'approve_marks';

  select t.verification_status, p.full_name, t.slug, t.partner_id
    into v_status, v_name, v_slug, v_partner
    from public.tutor_profiles t join public.profiles p on p.id = t.id
   where t.id = p_tutor_id
   for update of t;
  if not found then
    raise exception 'tutor not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    return jsonb_build_object('applied', false, 'status', v_status);
  end if;
  if v_marks and v_partner is not null then
    raise exception 'A tutoring centre''s tutor cannot hold the marks verified seal.' using errcode = '22023';
  end if;

  update public.tutor_profiles
     set verification_status = v_new,
         marks_status        = case when v_marks then 'verified' else 'none' end,
         marks_requested_at  = null
   where id = p_tutor_id;

  perform public._log_admin_action(
    'verification_' || case when p_decision = 'reject' then 'rejected' else 'approved' end,
    'tutor', p_tutor_id, v_name, p_reason,
    case when v_marks then jsonb_build_object('marks', true) else '{}'::jsonb end);

  return jsonb_build_object('applied', true, 'status', v_new, 'marks', v_marks,
                            'notify_user_id', p_tutor_id,
                            'name', v_name, 'slug', v_slug, 'reason', public._clean_reason(p_reason));
end;
$$;

-- A tutor's seal request. Only one that is STILL pending can be decided.
create or replace function public.admin_decide_marks(
  p_tutor_id uuid,
  p_decision text,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new   text;
  v_marks text;
  v_name  text;
  v_slug  text;
begin
  perform public._require_admin();
  if p_decision not in ('grant', 'decline') then
    raise exception 'unknown decision' using errcode = '22023';
  end if;
  v_new := case when p_decision = 'grant' then 'verified' else 'declined' end;

  select t.marks_status, p.full_name, t.slug into v_marks, v_name, v_slug
    from public.tutor_profiles t join public.profiles p on p.id = t.id
   where t.id = p_tutor_id
   for update of t;
  if not found then
    raise exception 'tutor not found' using errcode = 'P0002';
  end if;
  if v_marks <> 'pending' then
    return jsonb_build_object('applied', false, 'status', v_marks);
  end if;

  update public.tutor_profiles set marks_status = v_new where id = p_tutor_id;

  perform public._log_admin_action(
    'marks_' || case when p_decision = 'grant' then 'granted' else 'declined' end,
    'tutor', p_tutor_id, v_name, p_reason);

  return jsonb_build_object('applied', true, 'status', v_new, 'notify_user_id', p_tutor_id,
                            'name', v_name, 'slug', v_slug, 'reason', public._clean_reason(p_reason));
end;
$$;

-- Grant or revoke directly, with or without a request. Deliberately NOT behind
-- _assert_admin_target: the admins are tutors themselves and may hold the seal.
-- A grant also settles a pending request; a revoke only applies to a held seal.
create or replace function public.admin_set_marks(
  p_tutor_id uuid,
  p_granted  boolean,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status  text;
  v_marks   text;
  v_partner uuid;
  v_name    text;
  v_slug    text;
  v_new     text;
begin
  perform public._require_admin();
  if p_granted is null then
    raise exception 'unknown decision' using errcode = '22023';
  end if;

  select t.verification_status, t.marks_status, t.partner_id, p.full_name, t.slug
    into v_status, v_marks, v_partner, v_name, v_slug
    from public.tutor_profiles t join public.profiles p on p.id = t.id
   where t.id = p_tutor_id
   for update of t;
  if not found then
    raise exception 'tutor not found' using errcode = 'P0002';
  end if;
  if v_status <> 'verified' or v_partner is not null then
    raise exception 'Only a verified tutor who is not listed by a tutoring centre can hold the marks verified seal.'
      using errcode = '22023';
  end if;

  if p_granted = (v_marks = 'verified') then
    return jsonb_build_object('applied', false, 'status', v_marks);
  end if;
  v_new := case when p_granted then 'verified' else 'none' end;

  update public.tutor_profiles
     set marks_status = v_new,
         marks_requested_at = case when p_granted then marks_requested_at else null end
   where id = p_tutor_id;

  perform public._log_admin_action(
    case when p_granted then 'marks_granted' else 'marks_revoked' end,
    'tutor', p_tutor_id, v_name, p_reason, jsonb_build_object('direct', true));

  return jsonb_build_object('applied', true, 'status', v_new, 'notify_user_id', p_tutor_id,
                            'name', v_name, 'slug', v_slug, 'reason', public._clean_reason(p_reason));
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
  'managed_document_changed', 'verification_set', 'managed_setup_done',
  'managed_setup_sent', 'managed_setup_resent', 'managed_setup_recalled', 'managed_tutor_verified',
  'marks_granted', 'marks_declined', 'marks_revoked'
));

-- Seal requests share the Verification queue, so they share its count.
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
    'verifications', (select count(*) from public.tutor_profiles
                       where verification_status = 'pending' or marks_status = 'pending'),
    'reviews',       (select count(*) from public.reviews where status = 'pending'),
    'reports',       (select count(*) from public.reports where status = 'pending'),
    'revisions',     (select count(*) from public.tutor_profile_revisions where status = 'pending'),
    'invites',       (select count(*) from public.tutor_profiles
                       where managed_at is not null and partner_id is null)
  );
end;
$$;

-- Grants -------------------------------------------------------------------------
revoke all     on function public.request_marks_verification()              from public, anon;
revoke all     on function public.withdraw_marks_request()                  from public, anon;
revoke all     on function public.admin_decide_marks(uuid, text, text)      from public, anon;
revoke all     on function public.admin_set_marks(uuid, boolean, text)      from public, anon;

grant  execute on function public.request_marks_verification()              to authenticated;
grant  execute on function public.withdraw_marks_request()                  to authenticated;
grant  execute on function public.admin_decide_marks(uuid, text, text)      to authenticated;
grant  execute on function public.admin_set_marks(uuid, boolean, text)      to authenticated;

commit;
