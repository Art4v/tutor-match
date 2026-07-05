-- ============================================================================
-- tutormatch — slice 36: ATAR becomes a genuine credential
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0035 (in order).
--
-- WHY:
--   The ATAR used to live ONLY in the scalar `atar` column and was force-merged
--   into position 0 of the credentials list on every read (bridgeAtarIntoCredentials
--   in lib/supabase/tutors.js). That meant a tutor could never rank another
--   credential above their ATAR, and the card always featured the ATAR. We now
--   treat the ATAR as a normal `credentials` entry (icon="atar") — the single
--   source of truth for its value AND its order — so the tutor controls which
--   credential leads. The `atar` scalar column is KEPT but demoted to a
--   write-derived mirror, recomputed from the credential on every save and read
--   ONLY by the /browse Minimum-ATAR filter (query.gte("atar", ...), indexed in
--   0004). It is never read for display again.
--
-- WHAT THIS DOES:
--   1. Backfills the ATAR into each tutor's `credentials` jsonb at the front
--      (= the old display position), idempotently.
--   2. Re-creates save_tutor_profile so it enforces the single-ATAR invariant
--      server-side: exactly one credential may carry icon="atar" (the ATAR now
--      doubles as the browse-filter value, so a second one is ambiguous). The
--      client editor also hides the option, but this DB check is the
--      authoritative gate since saveTutorProfile runs in the browser client.
-- ============================================================================

-- 1. Backfill: prepend an ATAR credential to rows that have an ATAR but no ATAR
--    entry yet. `to_char(atar,'FM990.00')` reproduces the old 2-decimal display
--    (97.75, 99.00). The @> guard makes re-runs a no-op.
update public.tutor_profiles
set credentials = jsonb_build_array(
      jsonb_build_object('label', to_char(atar, 'FM990.00'), 'icon', 'atar')
    ) || coalesce(credentials, '[]'::jsonb)
where atar is not null
  and not (coalesce(credentials, '[]'::jsonb) @> '[{"icon":"atar"}]');

-- 2. Re-create the atomic save RPC (0029 body verbatim) with one added guard:
--    reject a payload carrying more than one ATAR credential.
create or replace function public.save_tutor_profile(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid  := auth.uid();
  v_profile jsonb := coalesce(p_payload -> 'profile', '{}'::jsonb);
  v_service jsonb := v_profile -> 'service_area';
  v_dropped text[] := '{}';
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;

  -- At most one ATAR credential: the ATAR doubles as the /browse filter value,
  -- so a second one is ambiguous. Authoritative gate (client editor also hides
  -- the option, but saveTutorProfile runs in the browser and is bypassable).
  if (select count(*)
        from jsonb_array_elements(coalesce(v_profile -> 'credentials', '[]'::jsonb)) e
        where e ->> 'icon' = 'atar') > 1 then
    raise exception 'Only one ATAR credential is allowed';
  end if;

  -- 1. Scalar columns. NB: `verified` / `verification_status` are intentionally
  --    NOT writable here — a tutor must not be able to self-verify (0021/0028).
  update public.tutor_profiles set
    suburb             = nullif(v_profile ->> 'suburb', ''),
    city               = nullif(v_profile ->> 'city', ''),
    initials           = nullif(v_profile ->> 'initials', ''),
    avatar_bg          = nullif(v_profile ->> 'avatar_bg', ''),
    banner_bg          = nullif(v_profile ->> 'banner_bg', ''),
    avatar_url         = nullif(v_profile ->> 'avatar_url', ''),
    banner_url         = nullif(v_profile ->> 'banner_url', ''),
    delivers_in_person = coalesce((v_profile ->> 'delivers_in_person')::bool, true),
    delivers_online    = coalesce((v_profile ->> 'delivers_online')::bool, true),
    responsive         = nullif(v_profile ->> 'responsive', ''),
    languages          = coalesce(
                           array(select jsonb_array_elements_text(coalesce(v_profile -> 'languages', '[]'::jsonb))),
                           '{}'::text[]),
    years_tutoring     = coalesce((v_profile ->> 'years_tutoring')::int, 0),
    year_min           = coalesce((v_profile ->> 'year_min')::int, 0),
    year_max           = coalesce((v_profile ->> 'year_max')::int, 12),
    credentials        = coalesce(v_profile -> 'credentials', '[]'::jsonb),
    bio                = nullif(v_profile ->> 'bio', ''),
    bio_long           = nullif(v_profile ->> 'bio_long', ''),
    atar               = nullif(v_profile ->> 'atar', '')::numeric,
    rank               = nullif(v_profile ->> 'rank', ''),
    rank_subject       = nullif(v_profile ->> 'rank_subject', ''),
    rate               = coalesce((v_profile ->> 'rate')::int, 0),
    service_area       = v_service,
    -- Denormalised copies of service_area for the /browse geo filter (0008).
    service_lat        = nullif(v_service ->> 'lat', '')::double precision,
    service_lng        = nullif(v_service ->> 'lng', '')::double precision,
    service_radius_km  = nullif(v_service ->> 'radiusKm', '')::int,
    availability       = coalesce(v_profile -> 'availability', '[]'::jsonb),
    visibility         = coalesce(nullif(v_profile ->> 'visibility', ''), 'public'),
    updated_at         = now()
  where id = v_id;

  -- 2. tutor_packages (replace-all).
  delete from public.tutor_packages where tutor_id = v_id;
  insert into public.tutor_packages (tutor_id, label, price, position)
  select v_id,
         coalesce(elem ->> 'label', ''),
         coalesce((elem ->> 'price')::int, 0),
         (ord - 1)::int
  from jsonb_array_elements(coalesce(p_payload -> 'packages', '[]'::jsonb))
       with ordinality as t(elem, ord);

  -- 3. tutor_experience (replace-all).
  delete from public.tutor_experience where tutor_id = v_id;
  insert into public.tutor_experience (tutor_id, role, org, period, note, position)
  select v_id,
         nullif(elem ->> 'role', ''),
         nullif(elem ->> 'org', ''),
         nullif(elem ->> 'period', ''),
         nullif(elem ->> 'note', ''),
         (ord - 1)::int
  from jsonb_array_elements(coalesce(p_payload -> 'experience', '[]'::jsonb))
       with ordinality as t(elem, ord);

  -- 4. tutor_education (replace-all). Resolve school_slug -> school_id, but only
  --    for high-school rows (a University row must not keep a stale school_id).
  delete from public.tutor_education where tutor_id = v_id;
  insert into public.tutor_education (tutor_id, school, school_id, detail, level, position)
  select v_id,
         nullif(elem ->> 'school', ''),
         case
           when coalesce(elem ->> 'level', 'high_school') = 'high_school'
                and nullif(elem ->> 'school_slug', '') is not null
           then (select id from public.schools where slug = elem ->> 'school_slug')
           else null
         end,
         nullif(elem ->> 'detail', ''),
         coalesce(nullif(elem ->> 'level', ''), 'high_school'),
         (ord - 1)::int
  from jsonb_array_elements(coalesce(p_payload -> 'education', '[]'::jsonb))
       with ordinality as t(elem, ord);

  -- 5. tutor_subjects (replace-all). Resolve slug -> subject_id; unknown slugs
  --    are dropped and returned so the UI can warn. Positions stay sequential
  --    over the RESOLVED set, preserving the tutor's chosen order (0014).
  select coalesce(array_agg(slug order by ord), '{}'::text[])
    into v_dropped
  from jsonb_array_elements_text(coalesce(p_payload -> 'subjects', '[]'::jsonb))
       with ordinality as t(slug, ord)
  where not exists (select 1 from public.subjects s where s.slug = slug);

  delete from public.tutor_subjects where tutor_id = v_id;
  insert into public.tutor_subjects (tutor_id, subject_id, position)
  select v_id, s.id, (row_number() over (order by t.ord)) - 1
  from jsonb_array_elements_text(coalesce(p_payload -> 'subjects', '[]'::jsonb))
       with ordinality as t(slug, ord)
  join public.subjects s on s.slug = t.slug;

  return jsonb_build_object('dropped_subjects', to_jsonb(v_dropped));
end;
$$;

revoke all     on function public.save_tutor_profile(jsonb) from public;
grant  execute on function public.save_tutor_profile(jsonb) to authenticated;
