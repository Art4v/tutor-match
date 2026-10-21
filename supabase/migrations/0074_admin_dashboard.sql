-- ============================================================================
-- 0074 — the in-app admin dashboard (/admin)
-- ----------------------------------------------------------------------------
-- Until now every admin decision arrived as an email to ADMIN_EMAIL carrying a
-- signed HMAC link, and the link itself was the authorization: whoever held it
-- could decide, and nothing recorded who did. This moves every admin control
-- into /admin, behind a real capability, with an audit trail.
--
--   1. profiles.is_admin — the capability. NOT writable by any client path:
--      the guard trigger RAISES on a change (rather than silently pinning, as
--      it does for the older flags), so a stray write fails loudly. Granted
--      and revoked only with supabase/utilities/grant_admin.sql. There is
--      deliberately no RPC that writes it, so a compromised admin account
--      cannot mint more admins.
--   2. profiles.admin_alerts_muted — per-admin opt-out of the alert emails.
--      Self-writable through "profile self update"; harmless for a non-admin.
--   3. is_admin() — the single capability check
--      (flag AND status = 'enabled', the same shape as _is_company_inviter).
--   4. admin_actions — append-only history, admin-readable, written only by
--      the RPCs below through _log_admin_action.
--   5. One SECURITY DEFINER RPC per admin action. Each re-checks is_admin(),
--      takes an optional reason, carries a pending predicate (so a second
--      admin clicking the same item gets { applied: false, status } instead of
--      overwriting), and logs. The routes in app/api/admin/ wrap them for the
--      side effects SQL cannot do: emails, Storage copies, revalidation.
--   6. Company invites move to admins: _is_company_inviter() now delegates to
--      is_admin(), so the three 0068 RPCs are unchanged at their call sites.
--      can_invite_companies itself is dropped in 0075, after the app stops
--      reading it.
--
-- Additive: the old token routes keep working until the app that replaces
-- them is deployed. Deploy order: 0074 -> app -> 0075. Safe to re-run.
-- ============================================================================

-- 1 + 2. Columns ---------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin           boolean not null default false,
  add column if not exists admin_alerts_muted boolean not null default false;

-- The 0070 body plus one raised column. is_admin raises rather than pins so a
-- client attempt shows up as an error instead of a silent success.
create or replace function public.profiles_guard_capabilities()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.can_author_articles  := old.can_author_articles;
    new.can_invite_companies := old.can_invite_companies;

    if new.is_admin is distinct from old.is_admin then
      raise exception 'protected_column:is_admin' using errcode = '42501';
    end if;
    -- role is set once by choose_role / claim_partner_as; status is the
    -- moderation field flipped by admin_set_account_status / reports.
    if new.role is distinct from old.role then
      raise exception 'protected_column:role' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      raise exception 'protected_column:status' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- 3. The capability check --------------------------------------------------------
-- One function, used everywhere: by the admin RPCs below, by the
-- admin_actions policy (which runs as the querying user, so it must be
-- granted) and by the app (TopNav, the /admin guard, the API routes). It takes
-- no arguments and answers only about the caller, so granting it leaks nothing.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin
       from public.profiles p
      where p.id = auth.uid() and p.status = 'enabled'),
    false
  );
$$;

revoke all     on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

create or replace function public._require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

revoke all on function public._require_admin() from public, anon, authenticated;

-- Invites become an admin power. The 0068 RPCs call this, so they need no edit.
create or replace function public._is_company_inviter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

revoke all on function public._is_company_inviter() from public;

-- 4. History -------------------------------------------------------------------
create table if not exists public.admin_actions (
  id           uuid primary key default gen_random_uuid(),
  -- SET NULL so an admin deleting their account keeps the record;
  -- admin_name is the snapshot that survives it.
  admin_id     uuid references public.profiles(id) on delete set null,
  admin_name   text,
  action       text not null check (action in (
                 'verification_approved', 'verification_rejected',
                 'review_approved', 'review_rejected',
                 'report_disable_reported', 'report_disable_reporter',
                 'report_dismiss', 'report_remove_review',
                 'revision_approved', 'revision_rejected',
                 'account_disabled', 'account_enabled',
                 'author_granted', 'author_revoked',
                 'company_invited', 'company_link_issued',
                 'company_hidden', 'company_shown', 'company_deleted'
               )),
  target_type  text not null check (target_type in ('tutor', 'review', 'report', 'revision', 'company', 'user')),
  -- No FK: the target may be deleted later (a company, a review) and the
  -- history must outlive it. target_label is the readable snapshot.
  target_id    uuid,
  target_label text,
  reason       text check (reason is null or char_length(reason) <= 500),
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_admin_idx   on public.admin_actions (admin_id, created_at desc);
create index if not exists admin_actions_target_idx  on public.admin_actions (target_type, target_id, created_at desc);

alter table public.admin_actions enable row level security;

drop policy if exists "admin actions admin read" on public.admin_actions;
create policy "admin actions admin read" on public.admin_actions
  for select using (public.is_admin());
-- No write policies: append-only, and only through _log_admin_action.

-- Trimmed, blank -> NULL, capped at the CHECK's 500 characters.
create or replace function public._clean_reason(p_reason text)
returns text
language sql
immutable
as $$
  select left(nullif(btrim(coalesce(p_reason, '')), ''), 500);
$$;

create or replace function public._log_admin_action(
  p_action       text,
  p_target_type  text,
  p_target_id    uuid,
  p_target_label text,
  p_reason       text,
  p_details      jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_actions (admin_id, admin_name, action, target_type, target_id, target_label, reason, details)
  values (
    auth.uid(),
    (select full_name from public.profiles where id = auth.uid()),
    p_action, p_target_type, p_target_id, p_target_label,
    public._clean_reason(p_reason),
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

revoke all on function public._log_admin_action(text, text, uuid, text, text, jsonb) from public, anon, authenticated;

-- 5. Admin actions ---------------------------------------------------------------

-- Verification. Only a request that is STILL pending can be decided (the
-- same guard the token routes had).
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
  v_new    text;
  v_status text;
  v_name   text;
  v_slug   text;
begin
  perform public._require_admin();
  if p_decision not in ('approve', 'reject') then
    raise exception 'unknown decision' using errcode = '22023';
  end if;
  v_new := case when p_decision = 'approve' then 'verified' else 'rejected' end;

  select t.verification_status, p.full_name, t.slug into v_status, v_name, v_slug
    from public.tutor_profiles t join public.profiles p on p.id = t.id
   where t.id = p_tutor_id
   for update of t;
  if not found then
    raise exception 'tutor not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    return jsonb_build_object('applied', false, 'status', v_status);
  end if;

  update public.tutor_profiles set verification_status = v_new where id = p_tutor_id;

  perform public._log_admin_action(
    'verification_' || case when p_decision = 'approve' then 'approved' else 'rejected' end,
    'tutor', p_tutor_id, v_name, p_reason);

  return jsonb_build_object('applied', true, 'status', v_new, 'notify_user_id', p_tutor_id,
                            'name', v_name, 'slug', v_slug, 'reason', public._clean_reason(p_reason));
end;
$$;

-- Reviews. 'removed' is terminal, so the pending predicate also stops an
-- approval reviving a review a report took down.
create or replace function public.admin_decide_review(
  p_review_id uuid,
  p_decision  text,
  p_reason    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status  text;
  v_student uuid;
  v_label   text;
begin
  perform public._require_admin();
  if p_decision not in ('approve', 'reject') then
    raise exception 'unknown decision' using errcode = '22023';
  end if;

  select r.status, r.student_id,
         coalesce(pa.name, tp.full_name)
    into v_status, v_student, v_label
    from public.reviews r
    left join public.partners pa on pa.id = r.partner_id
    left join public.profiles tp on tp.id = r.tutor_id
   where r.id = p_review_id
   for update of r;
  if not found then
    raise exception 'review not found' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    return jsonb_build_object('applied', false, 'status', v_status);
  end if;

  if p_decision = 'approve' then
    update public.reviews set status = 'approved', approved_at = now() where id = p_review_id;
  else
    update public.reviews set status = 'rejected', approved_at = null where id = p_review_id;
  end if;

  perform public._log_admin_action(
    'review_' || case when p_decision = 'approve' then 'approved' else 'rejected' end,
    'review', p_review_id, 'Review of ' || coalesce(v_label, 'a deleted profile'), p_reason);

  return jsonb_build_object('applied', true,
                            'status', case when p_decision = 'approve' then 'approved' else 'rejected' end,
                            'reason', public._clean_reason(p_reason));
end;
$$;

-- Reports. Unlike the old resolve route, every write here is conditioned on
-- the report still being pending, so two admins cannot both act. Disabling an
-- admin is refused, as on the Users page.
create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_action    text,
  p_reason    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report     public.reports%rowtype;
  v_target     uuid;
  v_resolution text;
  v_label      text;
begin
  perform public._require_admin();

  v_resolution := case p_action
    when 'disable_reported' then 'disabled_reported'
    when 'disable_reporter' then 'disabled_reporter'
    when 'dismiss'          then 'dismissed'
    when 'remove_review'    then 'removed_review'
  end;
  if v_resolution is null then
    raise exception 'unknown action' using errcode = '22023';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;
  if v_report.status <> 'pending' then
    return jsonb_build_object('applied', false, 'status', v_report.status, 'resolution', v_report.resolution);
  end if;

  if p_action = 'remove_review' then
    if v_report.review_id is null then
      raise exception 'there is no review to remove' using errcode = '22023';
    end if;
    update public.reviews set status = 'removed', approved_at = null where id = v_report.review_id;
  end if;

  if p_action in ('disable_reported', 'disable_reporter') then
    v_target := case when p_action = 'disable_reported' then v_report.reported_id else v_report.reporter_id end;
    if v_target = auth.uid() then
      raise exception 'you cannot disable your own account' using errcode = '22023';
    end if;
    if exists (select 1 from public.profiles where id = v_target and is_admin) then
      raise exception 'admins cannot be disabled from the dashboard' using errcode = '22023';
    end if;
    update public.profiles set status = 'disabled' where id = v_target;
  end if;

  update public.reports
     set status = 'resolved', resolution = v_resolution, resolved_at = now()
   where id = p_report_id;

  select full_name into v_label from public.profiles where id = v_report.reported_id;

  perform public._log_admin_action(
    'report_' || p_action, 'report', p_report_id,
    'Report about ' || coalesce(v_label, 'a deleted account'), p_reason,
    jsonb_build_object('disabled_user_id', v_target));

  return jsonb_build_object('applied', true, 'status', 'resolved', 'resolution', v_resolution,
                            'disabled_user_id', v_target, 'reason', public._clean_reason(p_reason));
end;
$$;

-- Profile revisions wrap the 0072 service-role functions, which stay as they
-- are. The approve route copies staged files first (Storage cannot be reached
-- from SQL) and passes the map in.
create or replace function public.admin_apply_profile_revision(
  p_revision_id uuid,
  p_file_map    jsonb,
  p_reason      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_tutor  uuid;
  v_name   text;
begin
  perform public._require_admin();

  v_result := public.apply_profile_revision(p_revision_id, p_file_map);

  if coalesce((v_result ->> 'applied')::boolean, false) then
    v_tutor := (v_result ->> 'tutor_id')::uuid;
    select full_name into v_name from public.profiles where id = v_tutor;
    perform public._log_admin_action('revision_approved', 'revision', p_revision_id,
                                     'Profile changes by ' || coalesce(v_name, 'a tutor'), p_reason,
                                     jsonb_build_object('tutor_id', v_tutor));
  end if;
  return v_result;
end;
$$;

create or replace function public.admin_reject_profile_revision(
  p_revision_id uuid,
  p_reason      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_tutor  uuid;
  v_name   text;
begin
  perform public._require_admin();

  v_result := public.reject_profile_revision(p_revision_id, public._clean_reason(p_reason));

  if coalesce((v_result ->> 'rejected')::boolean, false) then
    v_tutor := (v_result ->> 'tutor_id')::uuid;
    select full_name into v_name from public.profiles where id = v_tutor;
    perform public._log_admin_action('revision_rejected', 'revision', p_revision_id,
                                     'Profile changes by ' || coalesce(v_name, 'a tutor'), p_reason,
                                     jsonb_build_object('tutor_id', v_tutor));
  end if;
  return v_result;
end;
$$;

-- Accounts. Admins are never a target (demoting or disabling one is a SQL job),
-- and nobody acts on themselves.
create or replace function public._assert_admin_target(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text;
  v_is_admin boolean;
begin
  if p_user_id = auth.uid() then
    raise exception 'you cannot change your own account here' using errcode = '22023';
  end if;
  select full_name, is_admin into v_name, v_is_admin from public.profiles where id = p_user_id;
  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;
  if v_is_admin then
    raise exception 'admin accounts can only be changed in SQL' using errcode = '22023';
  end if;
  return v_name;
end;
$$;

revoke all on function public._assert_admin_target(uuid) from public, anon, authenticated;

create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status  text,
  p_reason  text default null
)
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
  if p_status not in ('enabled', 'disabled') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  v_name := public._assert_admin_target(p_user_id);

  select status into v_old from public.profiles where id = p_user_id for update;
  if v_old = p_status then
    return jsonb_build_object('applied', false, 'status', v_old);
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  perform public._log_admin_action(
    case when p_status = 'disabled' then 'account_disabled' else 'account_enabled' end,
    'user', p_user_id, v_name, p_reason);

  return jsonb_build_object('applied', true, 'status', p_status, 'reason', public._clean_reason(p_reason));
end;
$$;

-- Authoring. The target must be a tutor: articles.author_id references
-- tutor_profiles (see grant_author.sql), so flagging anyone else grants a
-- capability they can never use.
create or replace function public.admin_set_author(
  p_user_id uuid,
  p_enabled boolean,
  p_reason  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_old  boolean;
begin
  perform public._require_admin();
  v_name := public._assert_admin_target(p_user_id);

  if not exists (select 1 from public.tutor_profiles where id = p_user_id and partner_id is null) then
    raise exception 'only tutors can be authors' using errcode = '22023';
  end if;

  select can_author_articles into v_old from public.profiles where id = p_user_id for update;
  if v_old = coalesce(p_enabled, false) then
    return jsonb_build_object('applied', false, 'enabled', v_old);
  end if;

  update public.profiles set can_author_articles = coalesce(p_enabled, false) where id = p_user_id;

  perform public._log_admin_action(
    case when p_enabled then 'author_granted' else 'author_revoked' end,
    'user', p_user_id, v_name, p_reason);

  return jsonb_build_object('applied', true, 'enabled', coalesce(p_enabled, false));
end;
$$;

-- Companies. Visibility goes through the 0065 cascade trigger, which updates
-- the company's tutors.
create or replace function public.admin_set_company_visibility(
  p_partner_id uuid,
  p_visibility text,
  p_reason     text default null
)
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
  if p_visibility not in ('public', 'hidden') then
    raise exception 'unknown visibility' using errcode = '22023';
  end if;

  select name, visibility into v_name, v_old from public.partners where id = p_partner_id for update;
  if not found then
    raise exception 'company not found' using errcode = 'P0002';
  end if;
  if v_old = p_visibility then
    return jsonb_build_object('applied', false, 'visibility', v_old);
  end if;

  update public.partners set visibility = p_visibility where id = p_partner_id;

  perform public._log_admin_action(
    case when p_visibility = 'hidden' then 'company_hidden' else 'company_shown' end,
    'company', p_partner_id, v_name, p_reason);

  return jsonb_build_object('applied', true, 'visibility', p_visibility);
end;
$$;

-- Port of supabase/utilities/delete_company.sql (see that file for the why of
-- each step). Storage files are left behind, as there.
create or replace function public.admin_delete_company(
  p_partner_id uuid,
  p_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_company public.partners%rowtype;
  v_tutors  int;
begin
  perform public._require_admin();

  select * into v_company from public.partners where id = p_partner_id for update;
  if not found then
    raise exception 'company not found' using errcode = 'P0002';
  end if;

  delete from auth.users u
   using public.tutor_profiles t
   where t.id = u.id and t.partner_id = v_company.id;
  get diagnostics v_tutors = row_count;

  if v_company.owner_id is not null then
    update public.profiles set role = null where id = v_company.owner_id and role = 'partner';
  end if;

  delete from public.partners where id = v_company.id;

  perform public._log_admin_action('company_deleted', 'company', v_company.id, v_company.name, p_reason,
                                   jsonb_build_object('slug', v_company.slug, 'tutors', v_tutors,
                                                      'owner_id', v_company.owner_id));

  return jsonb_build_object('applied', true, 'tutors', v_tutors);
end;
$$;

-- Queue sizes for the TopNav badge and the overview.
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
    'revisions',     (select count(*) from public.tutor_profile_revisions where status = 'pending')
  );
end;
$$;

-- 6. Invites: log them. Bodies are 0068's with a log line added;
-- partner_link_target loses STABLE because it now writes.
create or replace function public.create_partner_as_inviter(
  p_name            text,
  p_website         text,
  p_suburb          text,
  p_state           text,
  p_allow_duplicate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text := btrim(coalesce(p_name, ''));
  v_website text := nullif(btrim(coalesce(p_website, '')), '');
  v_suburb  text := nullif(btrim(coalesce(p_suburb, '')), '');
  v_state   text := nullif(upper(btrim(coalesce(p_state, ''))), '');
  v_matches jsonb;
  v_id      uuid;
  v_slug    text;
begin
  if not public._is_company_inviter() then
    raise exception 'not allowed to invite companies' using errcode = '42501';
  end if;

  if v_name = '' then
    raise exception 'company name is required' using errcode = '22023';
  end if;
  if length(v_name) > 120 then
    raise exception 'company name is too long' using errcode = '22023';
  end if;
  if v_state is not null
     and v_state not in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT') then
    raise exception 'unknown state code' using errcode = '22023';
  end if;
  if v_website is not null and v_website !~* '^https?://' then
    v_website := 'https://' || v_website;
  end if;

  if not coalesce(p_allow_duplicate, false) then
    select jsonb_agg(jsonb_build_object(
             'name',       pa.name,
             'slug',       pa.slug,
             'claimed',    pa.owner_id is not null,
             'invited_by', inviter.full_name
           ) order by pa.created_at)
      into v_matches
      from public.partners pa
      left join public.profiles inviter on inviter.id = pa.created_by
     where lower(btrim(pa.name)) = lower(v_name);

    if v_matches is not null then
      return jsonb_build_object('status', 'duplicate', 'matches', v_matches);
    end if;
  end if;

  insert into public.partners (name, website_url, suburb, city, visibility, created_by, slug)
  values (v_name, v_website, v_suburb, v_state, 'hidden', auth.uid(),
          'pending-' || replace(gen_random_uuid()::text, '-', ''))
  returning id into v_id;

  v_slug := public._assign_partner_slug(v_id, v_name);

  perform public._log_admin_action('company_invited', 'company', v_id, v_name, null,
                                   jsonb_build_object('slug', v_slug));

  return jsonb_build_object('status', 'created', 'id', v_id, 'slug', v_slug);
end;
$$;

drop function if exists public.partner_link_target(uuid);
create function public.partner_link_target(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_unclaimed boolean;
  v_name      text;
begin
  if not public._is_company_inviter() then
    raise exception 'not allowed to invite companies' using errcode = '42501';
  end if;

  select pa.owner_id is null, pa.name into v_unclaimed, v_name from public.partners pa where pa.id = p_id;
  if v_unclaimed then
    perform public._log_admin_action('company_link_issued', 'company', p_id, v_name, null);
  end if;
  return v_unclaimed;
end;
$$;

-- Grants -------------------------------------------------------------------------
revoke all     on function public.admin_decide_verification(uuid, text, text)        from public, anon;
revoke all     on function public.admin_decide_review(uuid, text, text)              from public, anon;
revoke all     on function public.admin_resolve_report(uuid, text, text)             from public, anon;
revoke all     on function public.admin_apply_profile_revision(uuid, jsonb, text)    from public, anon;
revoke all     on function public.admin_reject_profile_revision(uuid, text)          from public, anon;
revoke all     on function public.admin_set_account_status(uuid, text, text)         from public, anon;
revoke all     on function public.admin_set_author(uuid, boolean, text)              from public, anon;
revoke all     on function public.admin_set_company_visibility(uuid, text, text)     from public, anon;
revoke all     on function public.admin_delete_company(uuid, text)                   from public, anon;
revoke all     on function public.admin_pending_counts()                             from public, anon;
revoke all     on function public.create_partner_as_inviter(text, text, text, text, boolean) from public, anon;
revoke all     on function public.partner_link_target(uuid)                          from public, anon;

grant  execute on function public.admin_decide_verification(uuid, text, text)        to authenticated;
grant  execute on function public.admin_decide_review(uuid, text, text)              to authenticated;
grant  execute on function public.admin_resolve_report(uuid, text, text)             to authenticated;
grant  execute on function public.admin_apply_profile_revision(uuid, jsonb, text)    to authenticated;
grant  execute on function public.admin_reject_profile_revision(uuid, text)          to authenticated;
grant  execute on function public.admin_set_account_status(uuid, text, text)         to authenticated;
grant  execute on function public.admin_set_author(uuid, boolean, text)              to authenticated;
grant  execute on function public.admin_set_company_visibility(uuid, text, text)     to authenticated;
grant  execute on function public.admin_delete_company(uuid, text)                   to authenticated;
grant  execute on function public.admin_pending_counts()                             to authenticated;
grant  execute on function public.create_partner_as_inviter(text, text, text, text, boolean) to authenticated;
grant  execute on function public.partner_link_target(uuid)                          to authenticated;
