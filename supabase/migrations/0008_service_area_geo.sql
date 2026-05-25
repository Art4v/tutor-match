-- ============================================================================
-- tutormatch — slice 8: geospatial service-area matching
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0007 (in order).
--
-- WHY:
--   Tutors already set a base suburb + travel radius (stored in the untyped
--   `service_area` JSONB), and the editor geocodes the suburb to lat/lng. But
--   those coords lived only inside the JSONB blob, so the public /browse query
--   couldn't use them — searching by location was an exact `city` string match.
--
--   To let students search "tutors who travel to my suburb", we need to filter
--   tutor_profiles by distance in SQL (so pagination + exact counts stay
--   correct). That means lifting lat/lng/radius into real, queryable columns
--   and providing a distance helper.
--
-- WHAT THIS DOES:
--   1. Adds service_lat / service_lng / service_radius_km columns (denormalised
--      copies of the service_area JSONB).
--   2. Backfills them from existing service_area JSONB.
--   3. Adds a btree index on (service_lat, service_lng).
--   4. Adds tutors_within_service_radius(lat, lng, include_online) — a haversine
--      distance function (no extension required) that returns the ids of public,
--      confirmed tutors whose travel radius covers the given point, optionally
--      OR-ing in online-delivery tutors. Used by getTutorsForBrowse() as the
--      "resolve ids first, then .in()" step (same pattern as subject filtering).
--
-- NOTE: the app keeps writing the full `service_area` JSONB too (for the map on
--   the profile page); saveTutorProfile() now writes both representations.
-- ============================================================================

-- 1. Queryable columns -------------------------------------------------------

alter table public.tutor_profiles
  add column service_lat       double precision,
  add column service_lng       double precision,
  add column service_radius_km integer;

-- 2. Backfill from existing JSONB --------------------------------------------

update public.tutor_profiles
set service_lat       = (service_area ->> 'lat')::double precision,
    service_lng       = (service_area ->> 'lng')::double precision,
    service_radius_km = coalesce((service_area ->> 'radiusKm')::integer, 5)
where service_area is not null;

-- 3. Index -------------------------------------------------------------------
-- A plain btree on the two coords is enough at our scale to keep the distance
-- function from scanning the whole table once data grows.

create index on public.tutor_profiles (service_lat, service_lng);

-- 4. Distance helper ---------------------------------------------------------
-- Plain great-circle (haversine) maths in SQL — no PostGIS / earthdistance
-- extension to enable, so Supabase setup stays a copy-paste of these files.
--
-- Returns tutor ids where EITHER the tutor delivers online (and the caller
-- asked to include them) OR the tutor delivers in person and the point is
-- within their own service_radius_km of their base coords.
--
-- Not security definer: it only returns rows the caller could already read
-- (public + confirmed), which the existing RLS SELECT policies already permit
-- for the anon role.

create or replace function public.tutors_within_service_radius(
  p_lat            double precision,
  p_lng            double precision,
  p_include_online boolean default true
)
returns table (tutor_id uuid)
language sql
stable
as $$
  select id
  from public.tutor_profiles
  where visibility = 'public'
    and email_confirmed_at is not null
    and (
      (p_include_online and delivers_online)
      or (
        delivers_in_person
        and service_lat is not null
        and service_lng is not null
        and 6371 * 2 * asin(sqrt(
              power(sin(radians(service_lat - p_lat) / 2), 2)
            + cos(radians(p_lat)) * cos(radians(service_lat))
            * power(sin(radians(service_lng - p_lng) / 2), 2)
        )) <= coalesce(service_radius_km, 5)
      )
    );
$$;

grant execute on function public.tutors_within_service_radius(double precision, double precision, boolean)
  to anon, authenticated;
