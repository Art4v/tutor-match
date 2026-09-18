-- ============================================================================
-- tutormatch — 0065: partner tutors
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0063 (partners), 0064 (save_partner_profile).
--
-- THE CENTRAL DECISION:
--   A partner tutor is an ORDINARY `tutor_profiles` row whose `partner_id` is
--   set. Not a parallel table. That means /browse, every filter, ranking, the
--   card and the profile page all work on partner tutors with no new code — the
--   alternative was a second copy of the entire browse filter query that had to
--   stay in lockstep with the first one forever, which is the exact failure
--   0058 exists to document.
--
--   The price is that `tutor_profiles.id -> profiles.id -> auth.users.id` both
--   cascade, so a partner tutor MUST have an auth user. We mint a shadow one:
--   synthetic address on a reserved `.invalid` domain, no password, and no way
--   to sign in (see app/api/partners/tutors/route.js for the three guarantees
--   that have to hold).
--
--   ONE NULLABLE partner_id, not a boolean plus a link. The FK being non-null
--   IS the flag. Two columns encoding one fact can disagree; one cannot. (0028
--   collapsed `verified` into `verification_status` for the same reason.)
--
-- EVERY POLICY HERE IS ADDITIVE:
--   Postgres ORs policies together, so the new "a partner may write its tutors"
--   policies leave the 0001 `auth.uid() = id` self-write completely untouched.
--   Nothing an ordinary tutor can or cannot do changes in this migration. Do
--   not be tempted to "simplify" by editing the existing policies instead.
-- ============================================================================

-- 1. The column --------------------------------------------------------------

alter table public.tutor_profiles
  add column if not exists partner_id uuid references public.partners(id) on delete cascade;

create index if not exists tutor_profiles_partner_idx
  on public.tutor_profiles (partner_id) where partner_id is not null;

comment on column public.tutor_profiles.partner_id is
  'Non-null => this tutor is listed and controlled by a tutoring centre (0065). '
  'The tutor has a shadow auth user that cannot sign in; the centre edits the row.';

-- 2. Additive RLS: a partner may write the tutors it owns ---------------------

-- Helper so the same predicate isn't written six times and can't drift between
-- them. STABLE + SECURITY DEFINER: it reads `partners`, which the caller can
-- only see through its own policies, and an inline subquery would therefore
-- behave differently depending on who is asking. (Same reasoning as
-- conversation_writable() in 0054.)
create or replace function public.partner_owns_tutor(p_tutor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.tutor_profiles t
      join public.partners p on p.id = t.partner_id
     where t.id = p_tutor_id
       and p.owner_id = auth.uid()
  );
$$;

grant execute on function public.partner_owns_tutor(uuid) to authenticated;

drop policy if exists "tutor_profiles partner write" on public.tutor_profiles;
create policy "tutor_profiles partner write"
  on public.tutor_profiles for all
  using (
    partner_id is not null
    and exists (select 1 from public.partners p where p.id = partner_id and p.owner_id = auth.uid())
  )
  with check (
    partner_id is not null
    and exists (select 1 from public.partners p where p.id = partner_id and p.owner_id = auth.uid())
  );

-- The four ordered child tables. Same predicate, routed through the helper.
drop policy if exists "tutor_subjects partner write" on public.tutor_subjects;
create policy "tutor_subjects partner write"
  on public.tutor_subjects for all
  using (public.partner_owns_tutor(tutor_id))
  with check (public.partner_owns_tutor(tutor_id));

drop policy if exists "tutor_packages partner write" on public.tutor_packages;
create policy "tutor_packages partner write"
  on public.tutor_packages for all
  using (public.partner_owns_tutor(tutor_id))
  with check (public.partner_owns_tutor(tutor_id));

drop policy if exists "tutor_experience partner write" on public.tutor_experience;
create policy "tutor_experience partner write"
  on public.tutor_experience for all
  using (public.partner_owns_tutor(tutor_id))
  with check (public.partner_owns_tutor(tutor_id));

drop policy if exists "tutor_education partner write" on public.tutor_education;
create policy "tutor_education partner write"
  on public.tutor_education for all
  using (public.partner_owns_tutor(tutor_id))
  with check (public.partner_owns_tutor(tutor_id));

-- profiles: the partner sets its tutors' display names, and must be able to
-- READ them back. 0055 narrowed the public profiles read to
-- `role = 'tutor' AND status = 'enabled'`, which would hide a tutor from its
-- own centre the moment that account were disabled — so the read policy is not
-- redundant with the public one.
drop policy if exists "profiles partner read" on public.profiles;
create policy "profiles partner read"
  on public.profiles for select
  using (public.partner_owns_tutor(id));

drop policy if exists "profiles partner update" on public.profiles;
create policy "profiles partner update"
  on public.profiles for update
  using (public.partner_owns_tutor(id))
  with check (public.partner_owns_tutor(id));

-- Same story for tutor_profiles itself: 0055's public read is gated on the
-- tutor's own profiles.status, so without this a disabled shadow account would
-- vanish from its centre's editor.
drop policy if exists "tutor_profiles partner read" on public.tutor_profiles;
create policy "tutor_profiles partner read"
  on public.tutor_profiles for select
  using (
    partner_id is not null
    and exists (select 1 from public.partners p where p.id = partner_id and p.owner_id = auth.uid())
  );

-- 3. Provisioning a partner tutor --------------------------------------------
-- Called by /api/partners/tutors AFTER it has created the shadow auth user. It
-- cannot create that user itself (auth.users is not ours to write), so the route
-- does that half and this does the rest atomically.
--
-- Takes the uid EXPLICITLY and is granted only to service_role, for the same
-- reason as claim_partner_as in 0063: the caller is the platform acting on the
-- centre's behalf, not the centre itself.
create or replace function public.provision_partner_tutor(
  p_uid uuid,
  p_partner_id uuid,
  p_name text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visibility text;
  v_slug       text;
begin
  if p_uid is null or p_partner_id is null then
    raise exception 'uid and partner are required';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'a name is required';
  end if;

  -- Inherit the centre's current visibility, so adding a tutor to a hidden
  -- centre does not quietly publish them.
  select visibility into v_visibility from public.partners where id = p_partner_id;
  if v_visibility is null then
    raise exception 'no such partner';
  end if;

  -- handle_new_user() (0041) already inserted the profiles row with role NULL.
  -- Promote it to a tutor and set the display name. full_name is load-bearing:
  -- BROWSE_SELECT joins `profiles!inner`, so a null name would silently drop
  -- this tutor from every browse result with no error anywhere.
  update public.profiles
     set role = 'tutor',
         full_name = btrim(p_name)
   where id = p_uid;

  -- email_confirmed_at is equally load-bearing: all five public read helpers
  -- filter on it being non-null. A shadow account never confirms an email (its
  -- address is deliberately undeliverable), so we stamp it here.
  insert into public.tutor_profiles (id, slug, email_confirmed_at, partner_id, visibility)
  values (p_uid, p_uid::text, now(), p_partner_id, v_visibility);

  v_slug := public._assign_tutor_slug(p_uid, p_name);
  return v_slug;
end;
$$;

revoke all     on function public.provision_partner_tutor(uuid, uuid, text) from public;
grant  execute on function public.provision_partner_tutor(uuid, uuid, text) to service_role;

-- 4. Saving a partner tutor ---------------------------------------------------
-- Sibling of save_tutor_profile (0037), scoped by partner ownership instead of
-- `auth.uid() = id`. The existing RPC is NOT touched — a tutor editing their own
-- profile goes through exactly the code they always did.
create or replace function public.save_partner_tutor_profile(p_tutor_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile jsonb := coalesce(p_payload -> 'profile', '{}'::jsonb);
  v_name    text  := btrim(coalesce(p_payload ->> 'name', ''));
  v_dropped text[] := '{}';
begin
  if not public.partner_owns_tutor(p_tutor_id) then
    raise exception 'not your tutor';
  end if;
  if v_name = '' then
    raise exception 'a name is required';
  end if;

  update public.profiles set full_name = v_name where id = p_tutor_id;

  update public.tutor_profiles set
    bio        = nullif(v_profile ->> 'bio', ''),
    bio_long   = nullif(v_profile ->> 'bio_long', ''),
    avatar_url = nullif(v_profile ->> 'avatar_url', ''),
    avatar_bg  = nullif(v_profile ->> 'avatar_bg', ''),
    initials   = nullif(v_profile ->> 'initials', ''),
    year_min   = coalesce(nullif(v_profile ->> 'year_min', '')::int, year_min),
    year_max   = coalesce(nullif(v_profile ->> 'year_max', '')::int, year_max),
    updated_at = now()
  where id = p_tutor_id;

  -- Subjects: replace-all, resolving slugs server-side, position from order.
  -- Unknown slugs are REPORTED rather than silently dropped, matching
  -- save_tutor_profile's dropped_subjects contract.
  select coalesce(array_agg(s), '{}')
    into v_dropped
    from (
      select value as s
        from jsonb_array_elements_text(coalesce(p_payload -> 'subjects', '[]'::jsonb))
       where value not in (select slug from public.subjects)
    ) missing;

  delete from public.tutor_subjects where tutor_id = p_tutor_id;
  insert into public.tutor_subjects (tutor_id, subject_id, position)
  select p_tutor_id, s.id, (ord - 1)
    from jsonb_array_elements_text(coalesce(p_payload -> 'subjects', '[]'::jsonb))
         with ordinality as t(slug, ord)
    join public.subjects s on s.slug = t.slug;

  return jsonb_build_object('dropped_subjects', to_jsonb(v_dropped));
end;
$$;

revoke all     on function public.save_partner_tutor_profile(uuid, jsonb) from public;
grant  execute on function public.save_partner_tutor_profile(uuid, jsonb) to authenticated;

-- 5. Visibility cascade -------------------------------------------------------
-- Hiding a centre must hide its tutors, and un-hiding must bring them back.
--
-- This drives `tutor_profiles.visibility` rather than `profiles.status`, which
-- was the other obvious option and is the wrong one: `status` is the MODERATION
-- field (0052), flipped by the report-resolve route. Overloading it here would
-- mean un-hiding a centre could silently re-enable a shadow account that a
-- report had disabled. Different concerns, different columns.
--
-- Because unlisting a single tutor is a DELETE rather than a hide (see the
-- route), `visibility` carries no per-tutor intent that this could clobber.
create or replace function public.sync_partner_tutor_visibility(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visible boolean;
begin
  select p.visibility = 'public'
         and coalesce(owner.status, 'enabled') = 'enabled'
    into v_visible
    from public.partners p
    left join public.profiles owner on owner.id = p.owner_id
   where p.id = p_partner_id;

  if v_visible is null then
    return;
  end if;

  update public.tutor_profiles
     set visibility = case when v_visible then 'public' else 'hidden' end
   where partner_id = p_partner_id;
end;
$$;

revoke all on function public.sync_partner_tutor_visibility(uuid) from public;

create or replace function public.partners_cascade_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_partner_tutor_visibility(new.id);
  return null;
end;
$$;

drop trigger if exists partners_cascade_visibility on public.partners;
create trigger partners_cascade_visibility
  after update of visibility, owner_id on public.partners
  for each row execute function public.partners_cascade_visibility();

-- The owner being disabled has to cascade too. 0055's public read on
-- tutor_profiles checks the TUTOR's own profiles.status, not the owner's, so
-- without this a disabled centre owner would leave its tutors publicly listed.
create or replace function public.profiles_cascade_partner_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner uuid;
begin
  select id into v_partner from public.partners where owner_id = new.id;
  if v_partner is not null then
    perform public.sync_partner_tutor_visibility(v_partner);
  end if;
  return null;
end;
$$;

drop trigger if exists profiles_cascade_partner_visibility on public.profiles;
create trigger profiles_cascade_partner_visibility
  after update of status on public.profiles
  for each row execute function public.profiles_cascade_partner_visibility();

-- 6. Partner tutors cannot be messaged ---------------------------------------
-- THE one real cost of reusing tutor_profiles. With a separate table a partner
-- tutor was structurally unmessageable (conversations.tutor_id FKs
-- tutor_profiles, so there was simply no row to point at). A genuine, public,
-- email-confirmed tutor row satisfies every guard this function already had, so
-- the guard has to be added explicitly. Hiding the button is not a boundary.
--
-- Recreated verbatim from 0052 with ONE added condition.
create or replace function public.start_conversation(p_tutor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := auth.uid();
  v_role public.user_role;
  v_conv uuid;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;
  if p_tutor_id is null then
    raise exception 'tutor is required';
  end if;

  select role into v_role from public.profiles where id = v_id;
  if v_role is distinct from 'student' then
    raise exception 'only students can start conversations';
  end if;

  if not exists (
    select 1 from public.tutor_profiles t
    where t.id = p_tutor_id
      and t.visibility = 'public'
      and t.email_confirmed_at is not null
      -- 0065: a centre's tutor is contacted through the centre's own website,
      -- never by direct message.
      and t.partner_id is null
  ) then
    raise exception 'tutor is not available';
  end if;

  -- Block guard: refuse if either party has blocked the other.
  if exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = v_id       and b.blocked_id = p_tutor_id)
       or (b.blocker_id = p_tutor_id and b.blocked_id = v_id)
  ) then
    raise exception 'conversation blocked';
  end if;

  -- Disabled guard: refuse if either party's account is disabled.
  if exists (
    select 1 from public.profiles p
    where p.id in (v_id, p_tutor_id)
      and p.status = 'disabled'
  ) then
    raise exception 'account disabled';
  end if;

  insert into public.conversations (student_id, tutor_id)
  values (v_id, p_tutor_id)
  on conflict (student_id, tutor_id)
    do update set student_id = excluded.student_id   -- no-op, forces RETURNING
  returning id into v_conv;

  return v_conv;
end;
$$;

-- 7. Reviews stay centre-level ------------------------------------------------
-- reviews.tutor_id already points at tutor_profiles, so a partner tutor would be
-- reviewable the moment it exists. Keeping reviews on the CENTRE is a product
-- decision (0066 adds reviews.partner_id), so the write path has to refuse an
-- individual partner tutor. Enforced in the API route as a 403; this comment
-- exists so the next person knows it is deliberate, not an oversight.
