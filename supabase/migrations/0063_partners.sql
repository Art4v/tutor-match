-- ============================================================================
-- tutormatch — 0063: partners (tutoring centres)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0062 (the 'partner' enum value must already be committed — a new
--   enum value cannot be used in the same transaction that adds it).
--
-- WHAT A PARTNER IS:
--   A tutoring centre with its own public page. Partners are INVITE ONLY: we
--   create the row ourselves (pre-filled from the centre's own website), the
--   page goes live immediately, and the centre later claims it with a signed
--   link. There is deliberately NO verification column — only we can create a
--   partner, so existence is the endorsement and there is nothing left to
--   verify afterwards.
--
-- THE SHAPE THAT LOOKS WRONG BUT ISN'T:
--   Every other extension table (tutor_profiles, student_profiles) keys on
--   profiles.id. `partners` does NOT. It has its own uuid and a separate
--   nullable owner_id, because the row must exist BEFORE anyone signs up — we
--   build the page first and hand it over second. Keying on profiles.id would
--   make the entire invite model impossible. Do not "fix" this.
--
--   owner_id is ON DELETE SET NULL, not cascade, and that is load-bearing too.
--   Under cascade, an owner deleting their account would take the centre's page
--   (and later, every one of its tutors) with it. Under set null the partner
--   simply reverts to unclaimed: still live, still correct, re-claimable with a
--   fresh link. That is exactly the state it was in before they ever signed up.
--
--   rating / review_count are NOT added here. They arrive in 0065 together with
--   the trigger that maintains them, so the column and its only writer land in
--   the same migration (the lesson 0057/0058 paid for).
-- ============================================================================

-- 1. Tables -------------------------------------------------------------------

create table if not exists public.partners (
  id          uuid primary key default gen_random_uuid(),
  -- NULL until the centre claims the page. UNIQUE enforces one-to-one: an
  -- account owns at most one partner. A centre with two admins shares a login;
  -- an operator with three centres holds three accounts. Widening this later
  -- means a partner_members join table, with owner_id kept as primary owner.
  owner_id    uuid unique references public.profiles(id) on delete set null,
  slug        text not null unique,
  -- The BUSINESS name. Distinct from profiles.full_name, which is the PERSON
  -- who manages it. Keeping them apart is what lets ownership change hands
  -- without touching a single character of the public page.
  name        text not null check (btrim(name) <> ''),
  -- Where "Enquire at <name>" sends people. Partners cannot be DM'd.
  website_url text,
  bio         text,                                            -- one-line tagline
  bio_long    text,                                            -- the About section
  suburb      text,
  city        text,                                            -- stores the state code
  service_lat double precision,
  service_lng double precision,
  logo_url    text,
  banner_url  text,
  avatar_bg   text,
  banner_bg   text,
  initials    text,
  visibility  text not null default 'public'
                check (visibility in ('public', 'hidden')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists partners_visibility_idx on public.partners (visibility);
create index if not exists partners_city_idx       on public.partners (city);

-- The centre's one rate card. Every tutor listed under the partner displays
-- these prices rather than any rate of their own (see 0064).
create table if not exists public.partner_packages (
  id         uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  label      text not null,                                    -- "Single lesson"
  price      int  not null,                                    -- AUD
  position   int  not null default 0
);

create index if not exists partner_packages_partner_idx
  on public.partner_packages (partner_id, position);

-- 2. updated_at touch ---------------------------------------------------------
-- Same shape as articles_touch_updated_at (0061).

create or replace function public.partners_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists partners_touch_updated_at on public.partners;
create trigger partners_touch_updated_at
  before update on public.partners
  for each row execute function public.partners_touch_updated_at();

-- 3. Slug assignment ----------------------------------------------------------
-- Straight clone of the tutor pair from 0013, including the retry-on-collision
-- loop and the random-suffix escape hatch, so a rename can't strand the URL and
-- two centres with the same name can't deadlock each other.

create or replace function public._assign_partner_slug(p_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_slug text;
  v_n    int := 1;
begin
  v_base := regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  if v_base = '' then
    v_base := 'partner';
  end if;

  loop
    v_slug := case when v_n = 1 then v_base else v_base || '-' || v_n::text end;
    begin
      update public.partners set slug = v_slug where id = p_id;
      return v_slug;
    exception when unique_violation then
      v_n := v_n + 1;
      if v_n > 50 then
        v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
        update public.partners set slug = v_slug where id = p_id;
        return v_slug;
      end if;
    end;
  end loop;
end;
$$;

-- Takes an explicit id, so it must never be reachable from the API with an
-- arbitrary one. Same lockdown as _assign_tutor_slug.
revoke all on function public._assign_partner_slug(uuid, text) from public;
-- ...but scripts/create-partner.mjs does need it, to name a brand-new centre
-- race-safely right after inserting it. `revoke from public` strips the implicit
-- grant from every role, service_role included, so this has to be explicit or
-- creating a partner fails with "permission denied for function".
grant execute on function public._assign_partner_slug(uuid, text) to service_role;

-- The authenticated rename RPC. Target is derived from auth.uid() via the
-- ownership link, so a caller can only ever rewrite their OWN partner's slug.
create or replace function public.assign_partner_slug(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select id into v_id from public.partners where owner_id = v_uid;
  if v_id is null then
    raise exception 'no partner for current user';
  end if;
  return public._assign_partner_slug(v_id, p_name);
end;
$$;

revoke all     on function public.assign_partner_slug(text) from public;
grant  execute on function public.assign_partner_slug(text) to authenticated;

-- 4. RLS ----------------------------------------------------------------------

alter table public.partners         enable row level security;
alter table public.partner_packages enable row level security;

-- Public read. The `owner_id is null` arm is the whole point: an unclaimed page
-- is live, which is what lets us send a centre a link to their own finished
-- page as the pitch. Once claimed, the owning account being disabled hides it,
-- mirroring how 0055 treats tutors.
drop policy if exists "partners public read" on public.partners;
create policy "partners public read"
  on public.partners for select
  using (
    visibility = 'public'
    and (
      owner_id is null
      or exists (
        select 1 from public.profiles p
        where p.id = partners.owner_id and p.status = 'enabled'
      )
    )
  );

-- Owner read: unconditional, so a partner can still see and edit its own page
-- while visibility is 'hidden'.
drop policy if exists "partners owner read" on public.partners;
create policy "partners owner read"
  on public.partners for select
  using (owner_id = auth.uid());

-- Owner update. There is no INSERT or DELETE policy at all: partners are
-- created by us through the service role (see create_partner.sql) and are never
-- created or destroyed from the browser. `with check` repeats the predicate so
-- an update cannot hand the row to somebody else.
drop policy if exists "partners owner update" on public.partners;
create policy "partners owner update"
  on public.partners for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "partner_packages public read" on public.partner_packages;
create policy "partner_packages public read"
  on public.partner_packages for select
  using (
    exists (
      select 1 from public.partners p
      where p.id = partner_packages.partner_id
        and (
          p.owner_id = auth.uid()
          or (
            p.visibility = 'public'
            and (
              p.owner_id is null
              or exists (
                select 1 from public.profiles pr
                where pr.id = p.owner_id and pr.status = 'enabled'
              )
            )
          )
        )
    )
  );

drop policy if exists "partner_packages owner write" on public.partner_packages;
create policy "partner_packages owner write"
  on public.partner_packages for all
  using (
    exists (
      select 1 from public.partners p
      where p.id = partner_packages.partner_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.partners p
      where p.id = partner_packages.partner_id and p.owner_id = auth.uid()
    )
  );

-- 5. choose_role(): reject 'partner' -----------------------------------------
-- Recreated from 0041 with ONE behavioural change, and it is the change that
-- makes "invite only" true rather than merely customary.
--
-- 0041's body ends with `if p_role = 'tutor' then ... else <student> end if`,
-- a catch-all. Left alone, a caller passing the new enum value would be handed
-- role='partner' AND a student_profiles row — a corrupt account that no code
-- path expects. Raising instead means the ONLY way to become a partner is the
-- claim route, which writes through the service role after verifying a signed
-- token. The chooser UI not offering a Partner button is then a convenience,
-- not the boundary.
create or replace function public.choose_role(p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid := auth.uid();
  v_name    text;
  v_current public.user_role;
  v_confirmed_at timestamptz;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;
  if p_role is null then
    raise exception 'role is required';
  end if;
  if p_role = 'partner' then
    raise exception 'partner accounts are invite only';
  end if;

  -- Read the current state; lock the row so two concurrent calls can't both pass
  -- the "role is null" guard.
  select role, full_name into v_current, v_name
    from public.profiles
   where id = v_id
   for update;

  if not found then
    raise exception 'no profile for current user';
  end if;
  if v_current is not null then
    raise exception 'role already chosen';
  end if;

  update public.profiles set role = p_role where id = v_id;

  if p_role = 'tutor' then
    select email_confirmed_at into v_confirmed_at
      from auth.users where id = v_id;

    insert into public.tutor_profiles (id, slug, email_confirmed_at)
    values (v_id, v_id::text, v_confirmed_at);
    perform public._assign_tutor_slug(v_id, v_name);
  else
    insert into public.student_profiles (id) values (v_id);
  end if;
end;
$$;

grant execute on function public.choose_role(public.user_role) to authenticated;

-- 6. claim_partner_as(): bind an invited partner to a given account -----------
-- Called ONLY by /api/partners/claim, after it has verified the HMAC invite
-- token. The token says WHICH partner may be claimed; the route's session check
-- says WHO is claiming. This function is just the atomic write.
--
-- It takes the user id EXPLICITLY rather than reading auth.uid(), because the
-- route has to call it through the service-role client (the caller is a
-- role-less brand-new account with no rows of its own, so nothing it could do
-- under its own RLS would work) and the service role has no auth.uid() at all —
-- it is null there. Same shape and same lockdown as _assign_tutor_slug from
-- 0013: an explicit id, and execute revoked from the API roles so it can never
-- be reached from the browser with somebody else's.
--
-- Note the `owner_id is null` guard on the UPDATE: that single predicate is the
-- entire replay defence. A claimed partner cannot be re-claimed, so a forwarded
-- or leaked link is inert the moment it has been used once, which is why there
-- is no invites table, no single-use flag and no expiry bookkeeping to sync.
--
-- Deliberately does NOT create a tutor_profiles or student_profiles row. The
-- partners row IS the extension row for this account.
create or replace function public.claim_partner_as(p_partner_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid := p_user_id;
  v_current public.user_role;
  v_slug    text;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;

  select role into v_current from public.profiles where id = v_id for update;
  if not found then
    raise exception 'no profile for current user';
  end if;
  -- A tutor or student cannot become a partner: they already have an extension
  -- row and a public identity built on it. They need a separate account.
  if v_current is not null and v_current <> 'partner' then
    raise exception 'this account is already a % account', v_current;
  end if;
  -- One to one, enforced here as well as by the unique index so the failure is
  -- a readable message rather than a 23505.
  if exists (select 1 from public.partners where owner_id = v_id and id <> p_partner_id) then
    raise exception 'this account already manages a partner';
  end if;

  update public.partners
     set owner_id = v_id
   where id = p_partner_id
     and owner_id is null
  returning slug into v_slug;

  if v_slug is null then
    -- Either the partner does not exist, or somebody already claimed it.
    return null;
  end if;

  update public.profiles set role = 'partner' where id = v_id;
  return v_slug;
end;
$$;

-- No grant to authenticated, and that is the point. The claim route calls this
-- through the service role only after verifying the signed token. If it were
-- callable from the browser, a signed-in user could claim any centre by
-- guessing its uuid, and the invite would stop being an invite.
revoke all     on function public.claim_partner_as(uuid, uuid) from public;
grant  execute on function public.claim_partner_as(uuid, uuid) to service_role;
