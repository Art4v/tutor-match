-- ============================================================================
-- 0068 — company inviters: create companies and copy claim links in-app
-- ----------------------------------------------------------------------------
-- Until now the only way to create a company was `npm run create:company`,
-- which needs a terminal and the service-role key. This lets a small set of
-- designated people do it from /companies/invite instead.
--
--   1. profiles.can_invite_companies — the capability, a sibling of
--      can_author_articles (0061), pinned by the same guard trigger so nobody
--      can grant it to themselves. Backfilled for the two seeded authors.
--   2. partners.created_by — who invited the company (NULL = the CLI script).
--   3. _assign_partner_slug skips the reserved words `claim` and `invite`,
--      which are static routes under /companies and would shadow the page.
--   4. Three SECURITY DEFINER RPCs, each of which re-checks the capability:
--      create_partner_as_inviter, list_partners_for_inviter,
--      partner_link_target.
--
-- WHY DEFINER RPCs AND NOT RLS POLICIES: partners has no INSERT policy (0063)
-- and its public read hides `hidden` rows, and companies created here START
-- hidden. Widening partners RLS for inviters would mean an INSERT policy plus
-- a second SELECT policy that every future partners query then silently
-- inherits. Three narrow functions keep the capability check in one place and
-- leave the table's policies exactly as they were.
--
-- The route layer checks the flag too, but that is a convenience (a clean 403
-- instead of a raised exception). These functions are the boundary.
--
-- Companies created here are HIDDEN until the company claims them and clicks
-- "Make my page live". claim_partner_as (0063) never touches visibility and
-- the claim page reads through the service role, so a hidden company is still
-- claimable. The CLI script is unchanged and still creates live pages.
--
-- Additive after 0067. Safe to re-run.
-- ============================================================================

-- 1. Capability ---------------------------------------------------------------
alter table public.profiles
  add column if not exists can_invite_companies boolean not null default false;

-- Same function 0061 created, with one more pinned column. See 0061 for why
-- this is a trigger rather than a column REVOKE, and why it pins rather than
-- raises.
create or replace function public.profiles_guard_capabilities()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.can_author_articles  := old.can_author_articles;
    new.can_invite_companies := old.can_invite_companies;
  end if;
  return new;
end;
$$;

-- No-op on a fresh database where those slugs don't exist.
update public.profiles
   set can_invite_companies = true
 where id in (
   select id from public.tutor_profiles
    where slug in ('aarav-bhatt', 'eric-chen')
 );

-- 2. Who invited it -------------------------------------------------------------
-- SET NULL rather than cascade: an inviter deleting their account must not
-- take down the companies they created.
alter table public.partners
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

-- 3. Reserved slugs -------------------------------------------------------------
-- app/companies/claim and app/companies/invite are static segments, which
-- Next.js resolves ahead of [slug], so a company slugged `claim` or `invite`
-- would have an unreachable page. Starting those two at -2 is the whole fix.
-- Body otherwise identical to 0063.
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
  if v_base in ('claim', 'invite') then
    v_n := 2;
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

-- create or replace keeps existing grants, but restating them keeps this file
-- readable on its own. Still service_role only (plus definer callers below).
revoke all     on function public._assign_partner_slug(uuid, text) from public;
grant  execute on function public._assign_partner_slug(uuid, text) to service_role;

-- 4. The capability check -------------------------------------------------------
-- A disabled account keeps its flag but loses the power, same as every other
-- write in the app after 0052.
create or replace function public._is_company_inviter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.can_invite_companies
       from public.profiles p
      where p.id = auth.uid() and p.status = 'enabled'),
    false
  );
$$;

revoke all on function public._is_company_inviter() from public;

-- 5. Create -----------------------------------------------------------------------
-- Returns jsonb rather than raising on a duplicate name, because a duplicate is
-- a question for the inviter ("Create anyway?"), not an error. Two branches of
-- the same franchise can legitimately share a name, so this warns and never
-- blocks.
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
  -- Same eight codes as lib/states.js. `city` stores the state code, matching
  -- tutor_profiles.city, so a bad value here would break the /companies filter.
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

  return jsonb_build_object('status', 'created', 'id', v_id, 'slug', v_slug);
end;
$$;

revoke all     on function public.create_partner_as_inviter(text, text, text, text, boolean) from public;
grant  execute on function public.create_partner_as_inviter(text, text, text, text, boolean) to authenticated;

-- 6. List -------------------------------------------------------------------------
-- Every company, hidden and claimed included: inviters share one pipeline.
-- Companies from the CLI script show with a null invited_by_name.
create or replace function public.list_partners_for_inviter()
returns table (
  id              uuid,
  name            text,
  slug            text,
  visibility      text,
  claimed         boolean,
  created_at      timestamptz,
  invited_by_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._is_company_inviter() then
    raise exception 'not allowed to invite companies' using errcode = '42501';
  end if;

  return query
    select pa.id, pa.name, pa.slug, pa.visibility,
           pa.owner_id is not null,
           pa.created_at,
           inviter.full_name
      from public.partners pa
      left join public.profiles inviter on inviter.id = pa.created_by
     order by pa.created_at desc;
end;
$$;

revoke all     on function public.list_partners_for_inviter() from public;
grant  execute on function public.list_partners_for_inviter() to authenticated;

-- 7. Re-copy a link ---------------------------------------------------------------
-- The link is signed in Node (lib/companyToken.js is the single definition of
-- the token), so all the database has to answer is "may this caller have a
-- link for this company?". Returns true for an unclaimed company, false for a
-- claimed one (a fresh link would be inert), and null when there is no such id.
create or replace function public.partner_link_target(p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._is_company_inviter() then
    raise exception 'not allowed to invite companies' using errcode = '42501';
  end if;

  return (select pa.owner_id is null from public.partners pa where pa.id = p_id);
end;
$$;

revoke all     on function public.partner_link_target(uuid) from public;
grant  execute on function public.partner_link_target(uuid) to authenticated;
