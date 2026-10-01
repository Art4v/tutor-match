-- ============================================================================
-- tutormatch — 0069: partner tutors have no hourly rate
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0066 (sync_partner_tutors and its triggers).
--
-- THE PROBLEM:
--   0066 mirrored a centre's CHEAPEST PACKAGE into each of its tutors'
--   tutor_profiles.rate so the /browse "Max rate" filter had something to
--   compare. But `rate` is an hourly figure everywhere it is rendered, and a
--   centre's packages are not hourly: a "$1000 per term" package surfaced on
--   every one of its tutors' cards as "$1000 PER HOUR". The mirror turned a
--   true price into a false one.
--
-- THE FIX:
--   A centre prices by package only, so its tutors have no rate at all. The
--   rate half of sync_partner_tutors() is removed, the rate-card trigger that
--   only existed to feed it is dropped, and every partner tutor's rate is
--   cleared to NULL. /browse now lets partner tutors through the rate filter
--   explicitly (`partner_id.not.is.null`, lib/supabase/tutors.js) rather than
--   comparing them on a number nobody is shown.
--
--   The LOCATION half of 0066 is untouched: suburb / city / service_lat /
--   service_lng are still mirrored, and the partners_sync_tutors and
--   tutor_profiles_sync_from_partner triggers still fire it.
--
--   A CHECK (section 4) then keeps every partner tutor's rate NULL for good.
--
--   Ordinary tutors are untouched: every statement is scoped to
--   `partner_id is not null`, and the (rate) index stays for their filter.
-- ============================================================================

-- 1. The mirror, location only ------------------------------------------------

create or replace function public.sync_partner_tutors(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  select suburb, city, service_lat, service_lng
    into p
    from public.partners
   where id = p_partner_id;

  if not found then
    return;
  end if;

  update public.tutor_profiles t
     set suburb      = p.suburb,
         city        = p.city,
         service_lat = p.service_lat,
         service_lng = p.service_lng
   where t.partner_id = p_partner_id
     -- Skip no-op updates: they would churn updated_at on every centre save.
     and (t.suburb      is distinct from p.suburb
       or t.city        is distinct from p.city
       or t.service_lat is distinct from p.service_lat
       or t.service_lng is distinct from p.service_lng);
end;
$$;

revoke all on function public.sync_partner_tutors(uuid) from public;

-- 2. The rate card no longer feeds tutors -------------------------------------
-- Its only job was the rate mirror; a package change moves no tutor column now.

drop trigger if exists partner_packages_sync_tutors on public.partner_packages;
drop function if exists public.partner_packages_sync_tutors();

-- 3. Clear the mirrored rates -------------------------------------------------

update public.tutor_profiles
   set rate = null
 where partner_id is not null
   and rate is not null;

-- 4. Keep it that way ----------------------------------------------------------
-- Nothing in the app writes a partner tutor's rate any more (provision leaves it
-- NULL, save_partner_tutor_profile never mentions it, the sync above no longer
-- does), but 0065's "tutor_profiles partner write" policy lets a centre owner
-- UPDATE any column of their tutors' rows straight through PostgREST. A CHECK
-- makes "a partner tutor has no rate" structural rather than conventional, and
-- fails loudly if a future write path ever reintroduces one, where a pinning
-- trigger would hide the bug. Runs after the clear above, so existing rows pass.

alter table public.tutor_profiles
  drop constraint if exists tutor_profiles_partner_no_rate;
alter table public.tutor_profiles
  add constraint tutor_profiles_partner_no_rate
  check (partner_id is null or rate is null);
