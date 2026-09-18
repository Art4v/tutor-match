-- ============================================================================
-- tutormatch — 0066: partner tutors mirror their centre's rate and location
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0063 (partners, partner_packages), 0065 (tutor_profiles.partner_id).
--
-- THE PROBLEM, in both halves:
--   A centre owns its pricing and its address. Its tutors render the centre's
--   rate card and sit at the centre's site. But /browse does not read any of
--   that at render time — it FILTERS in SQL, on columns of tutor_profiles, long
--   before anything reaches a renderer:
--
--     * "Max rate"  -> .lte("rate", rateMax),  indexed since 0004
--     * "State"     -> .in("city", states)
--     * Location    -> tutors_within_service_radius(), on service_lat/lng
--
--   0065 left all four of those columns NULL on a partner tutor. The result is
--   the worst kind of bug, because nothing errors: a centre's tutor is silently
--   dropped by the two most-used location filters, and would be filtered in or
--   out on a rate NOBODY IS EVER SHOWN. Mixing partner tutors into browse is the
--   entire point of the shadow-account design, and without this they are only
--   half in it.
--
-- THE FIX, and why it is a mirror rather than a join:
--   These columns become write-derived for partner tutors, recomputed by
--   trigger from the centre. This is exactly the pattern 0036 used for `atar`:
--   demote a column to a derived mirror, keep it because an indexed scalar is
--   what the filter needs, and let one function own every write to it. Teaching
--   /browse to join `partners` instead would push extra work into the hot path
--   of the busiest query in the app for values that change about once a year.
--
--   For an ordinary tutor NOTHING changes: every statement here is scoped to
--   `partner_id is not null`, and a tutor's own save path still writes these
--   columns freely.
--
-- WHAT IS DELIBERATELY *NOT* MIRRORED:
--   `service_radius_km` stays null, which tutors_within_service_radius() already
--   reads as `coalesce(..., 5)` — a 5 km catchment. That is a guess rather than
--   a number a centre chose, and the honest fix if it proves too tight is a real
--   `partners.service_radius_km` column the centre can set, not a magic constant
--   invented here.
--
--   `delivers_in_person` / `delivers_online` also stay at their table defaults
--   (both true). Worth a product decision: "online" is a factual claim on the
--   profile that no centre has actually made. Left alone here rather than
--   changed silently.
-- ============================================================================

-- 1. The mirror ---------------------------------------------------------------
-- One function owns every derived write, so the rate half and the location half
-- cannot drift apart the way two near-identical functions would. (The lesson
-- 0058 paid for: one definition, not two correct copies.)

create or replace function public.sync_partner_tutors(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate int;
  p      record;
begin
  select suburb, city, service_lat, service_lng
    into p
    from public.partners
   where id = p_partner_id;

  if not found then
    return;
  end if;

  -- Cheapest package is what the card shows as "from $X", so it is also what
  -- the rateMax filter must compare against.
  select min(price) into v_rate
    from public.partner_packages
   where partner_id = p_partner_id;

  update public.tutor_profiles t
     set rate        = v_rate,
         suburb      = p.suburb,
         city        = p.city,
         service_lat = p.service_lat,
         service_lng = p.service_lng
   where t.partner_id = p_partner_id
     -- Skip no-op updates: they would churn updated_at on every centre save and
     -- fire the row triggers below for nothing.
     and (t.rate        is distinct from v_rate
       or t.suburb      is distinct from p.suburb
       or t.city        is distinct from p.city
       or t.service_lat is distinct from p.service_lat
       or t.service_lng is distinct from p.service_lng);
end;
$$;

revoke all on function public.sync_partner_tutors(uuid) from public;

-- 2. Triggers on each source --------------------------------------------------

-- The rate card. Uses OLD on delete, where NEW is null.
create or replace function public.partner_packages_sync_tutors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_partner_tutors(coalesce(new.partner_id, old.partner_id));
  return null;
end;
$$;

drop trigger if exists partner_packages_sync_tutors on public.partner_packages;
create trigger partner_packages_sync_tutors
  after insert or update or delete on public.partner_packages
  for each row execute function public.partner_packages_sync_tutors();

-- The centre's address.
create or replace function public.partners_sync_tutors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_partner_tutors(new.id);
  return null;
end;
$$;

drop trigger if exists partners_sync_tutors on public.partners;
create trigger partners_sync_tutors
  after update of suburb, city, service_lat, service_lng on public.partners
  for each row execute function public.partners_sync_tutors();

-- And when a tutor joins a centre, so a brand-new tutor is filterable
-- immediately rather than at the centre's next edit.
--
-- Scoped to `update of partner_id` (plus insert) deliberately: sync_partner_tutors
-- writes rate/suburb/city/service_*, and a broader trigger would re-fire on its
-- own write.
create or replace function public.tutor_profiles_sync_from_partner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_id is not null then
    perform public.sync_partner_tutors(new.partner_id);
  end if;
  return null;
end;
$$;

drop trigger if exists tutor_profiles_sync_from_partner on public.tutor_profiles;
create trigger tutor_profiles_sync_from_partner
  after insert or update of partner_id on public.tutor_profiles
  for each row execute function public.tutor_profiles_sync_from_partner();

-- 3. Reconcile anything created between 0065 and now --------------------------

do $$
declare
  r record;
begin
  for r in select distinct partner_id from public.tutor_profiles where partner_id is not null
  loop
    perform public.sync_partner_tutors(r.partner_id);
  end loop;
end;
$$;
