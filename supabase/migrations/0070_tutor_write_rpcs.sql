-- ============================================================================
-- tutormatch — 0070: every tutor write goes through a checked RPC (part 1 of 2)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0069 (in order).
--
-- DEPLOY ORDER: 0070 -> app deploy -> 0071.
--   This file only ADDS: new RPCs, stricter guards, bucket limits. The app that
--   is live when it runs keeps working (save_tutor_profile still accepts a
--   payload without `full_name`, and the old direct writes are still allowed).
--   0071 then removes the direct-write policies, which is only safe once the
--   app no longer uses them.
--
-- THE PROBLEM:
--   "tutor self rw" (0001) is `for all using (auth.uid() = id)` with no column
--   restriction, and the only guard (0057) pins rating/review_count. So from the
--   browser console a tutor could run
--     supabase.from('tutor_profiles').update({ verification_status: 'verified' })
--   and verify themselves, or rewrite slug / email_confirmed_at / partner_id.
--   A centre owner could do the same to its tutors through 0065's
--   "tutor_profiles partner write". On profiles, "profile self update" (0001)
--   has no WITH CHECK, so a disabled account could set status back to
--   'enabled', and anyone could change their own role.
--
-- THE FIX (this file):
--   1. Helpers: _require_own_tutor, _atar_from_credentials,
--      _valid_profile_image, _apply_tutor_payload, _apply_tutor_name.
--   2. save_tutor_profile rebuilt on them. It now also takes `full_name`, derives
--      the `atar` mirror itself rather than trusting the client's copy, checks
--      that a photo URL points into the caller's own profile-images folder, and
--      refuses company tutors. Two latent bugs from 0037 are fixed on the way:
--      `dropped_subjects` was always empty (the unqualified `slug` bound to
--      s.slug), and the body would violate 0069's rate CHECK for a company tutor.
--   3. save_partner_tutor_profile re-created to also write credentials + atar,
--      so a company tutor save is one atomic RPC instead of RPC + direct write.
--   4. New RPCs for the remaining direct writes: set_tutor_visibility,
--      mark_tutor_onboarded, add/rename/delete_tutor_document.
--   5. Guards RAISE (42501) when an authenticated/anon write changes a
--      protected column: verification_status, verification_requested_at,
--      partner_id, slug, email_confirmed_at on tutor_profiles; role, status on
--      profiles. Unlike the 0057/0061 pins these raise, so an attempt fails
--      loudly. A write that resends an unchanged value still passes.
--   6. profile-images gets the size + MIME limits tutor-docs already has.
--   7. Internal / service-only functions lose any EXECUTE grant anon or
--      authenticated might hold directly (a no-op where none exists).
--
-- WHO STILL WRITES THESE COLUMNS (all unaffected by the guards, because
-- current_user inside a SECURITY DEFINER function is its owner, and the
-- service-role client is not 'authenticated'):
--   request_tutor_verification, assign_tutor_slug / _assign_tutor_slug,
--   choose_role, provision_partner_tutor, claim_partner_as,
--   handle_user_email_confirmed, the verification approve/reject routes, the
--   report-resolve route, and the supabase/utilities SQL (run as postgres).
-- ============================================================================

-- 1. Helpers ------------------------------------------------------------------

-- The caller's own, non-company tutor row, locked for the rest of the
-- transaction so two concurrent saves serialise. Every tutor write RPC starts
-- here, so "who may write" is decided in exactly one place.
create or replace function public._require_own_tutor()
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id      uuid := auth.uid();
  v_partner uuid;
begin
  if v_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select partner_id into v_partner from public.tutor_profiles where id = v_id for update;
  if not found then
    raise exception 'no tutor profile for current user' using errcode = '42501';
  end if;
  if v_partner is not null then
    raise exception 'company tutors are edited by their company' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

-- The scalar `atar` mirror (0036), derived from the credentials array on the
-- server. It used to arrive in the payload, computed in the browser, so a
-- caller could send credentials saying 80.00 and atar 99.95 and pass the
-- /browse Minimum-ATAR filter on a number nobody is shown.
-- Mirrors extractAtarFromCredentials (lib/supabase/tutors.js): the first atar
-- credential with a numeric label, else NULL.
create or replace function public._atar_from_credentials(p_credentials jsonb)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_label text;
  v_atar  numeric;
begin
  if p_credentials is null or jsonb_typeof(p_credentials) <> 'array' then
    return null;
  end if;
  if (select count(*) from jsonb_array_elements(p_credentials) e
       where e ->> 'icon' = 'atar') > 1 then
    raise exception 'Only one ATAR credential is allowed' using errcode = '22023';
  end if;
  select btrim(e ->> 'label') into v_label
    from jsonb_array_elements(p_credentials) e
   where e ->> 'icon' = 'atar' and coalesce(btrim(e ->> 'label'), '') <> ''
   limit 1;
  if v_label is null or v_label !~ '^[0-9]+(\.[0-9]+)?$' then
    return null;
  end if;
  v_atar := v_label::numeric;
  if v_atar > 99.95 then
    raise exception 'ATAR must be 99.95 or lower' using errcode = '22023';
  end if;
  return round(v_atar, 2);
end;
$$;

-- May this URL be stored as a profile photo? Yes when it is empty, unchanged
-- (so legacy values keep saving), or a file directly inside `p_folder` in the
-- profile-images bucket of THIS project.
--
-- The project's public origin comes from the caller's JWT issuer
-- (`<origin>/auth/v1`), which is signed by this project, so a URL on another
-- host with the same path shape (say, a second Supabase project) is refused.
-- Matching on the path alone would not stop that. No issuer (not a PostgREST
-- request) means nothing new is accepted: fail closed.
create or replace function public._valid_profile_image(p_url text, p_current text, p_folder uuid)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_origin text;
  v_prefix text;
begin
  if p_url is null or p_url = '' then
    return true;
  end if;
  if p_url = p_current then
    return true;
  end if;
  v_origin := regexp_replace(coalesce(auth.jwt() ->> 'iss', ''), '/auth/v1/?$', '');
  if v_origin = '' or p_folder is null then
    return false;
  end if;
  v_prefix := v_origin || '/storage/v1/object/public/profile-images/' || p_folder::text || '/';
  return starts_with(p_url, v_prefix)
     and substr(p_url, length(v_prefix) + 1) ~ '^[A-Za-z0-9._-]+$';
end;
$$;

-- The body of save_tutor_profile (0037), moved here so every write path
-- (today the tutor's own save; in a later slice the admin applying an approved
-- revision) runs the same statements. Pure apply: it trusts its caller to have
-- decided WHO may write, and validates only the data itself.
create or replace function public._apply_tutor_payload(p_id uuid, p_payload jsonb, p_apply_visibility boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_profile jsonb := coalesce(p_payload -> 'profile', '{}'::jsonb);
  v_service jsonb := v_profile -> 'service_area';
  v_creds   jsonb := coalesce(v_profile -> 'credentials', '[]'::jsonb);
  v_dropped text[] := '{}';
begin
  -- A company tutor has no rate (0069's CHECK) and is saved by
  -- save_partner_tutor_profile. Refuse here too, not only in the callers.
  if exists (select 1 from public.tutor_profiles where id = p_id and partner_id is not null) then
    raise exception 'company tutors are edited by their company' using errcode = '42501';
  end if;

  -- 1. Scalar columns. verification_status / slug / partner_id / onboarded are
  --    deliberately absent: no save path may write them (0021/0028, guards 0070).
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
    credentials        = v_creds,
    -- Derived here, never taken from the payload (see _atar_from_credentials).
    atar               = public._atar_from_credentials(v_creds),
    bio                = nullif(v_profile ->> 'bio', ''),
    bio_long           = nullif(v_profile ->> 'bio_long', ''),
    rate               = coalesce((v_profile ->> 'rate')::int, 0),
    service_area       = v_service,
    -- Denormalised copies of service_area for the /browse geo filter (0008).
    service_lat        = nullif(v_service ->> 'lat', '')::double precision,
    service_lng        = nullif(v_service ->> 'lng', '')::double precision,
    service_radius_km  = nullif(v_service ->> 'radiusKm', '')::int,
    availability       = coalesce(v_profile -> 'availability', '[]'::jsonb),
    visibility         = case
                           when p_apply_visibility
                           then coalesce(nullif(v_profile ->> 'visibility', ''), 'public')
                           else visibility
                         end,
    updated_at         = now()
  where id = p_id;

  -- 2. tutor_packages (replace-all).
  delete from public.tutor_packages where tutor_id = p_id;
  insert into public.tutor_packages (tutor_id, label, price, position)
  select p_id,
         coalesce(elem ->> 'label', ''),
         coalesce((elem ->> 'price')::int, 0),
         (ord - 1)::int
  from jsonb_array_elements(coalesce(p_payload -> 'packages', '[]'::jsonb))
       with ordinality as t(elem, ord);

  -- 3. tutor_experience (replace-all).
  delete from public.tutor_experience where tutor_id = p_id;
  insert into public.tutor_experience (tutor_id, role, org, period, note, position)
  select p_id,
         nullif(elem ->> 'role', ''),
         nullif(elem ->> 'org', ''),
         nullif(elem ->> 'period', ''),
         nullif(elem ->> 'note', ''),
         (ord - 1)::int
  from jsonb_array_elements(coalesce(p_payload -> 'experience', '[]'::jsonb))
       with ordinality as t(elem, ord);

  -- 4. tutor_education (replace-all). Resolve school_slug -> school_id, but only
  --    for high-school rows (a University row must not keep a stale school_id).
  delete from public.tutor_education where tutor_id = p_id;
  insert into public.tutor_education (tutor_id, school, school_id, detail, level, position)
  select p_id,
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

  -- 5. tutor_subjects (replace-all). Unknown slugs are dropped and returned so
  --    the UI can warn. `t.slug` is qualified: 0029-0037 wrote a bare `slug`,
  --    which bound to s.slug, so the list was always empty.
  select coalesce(array_agg(t.slug order by t.ord), '{}'::text[])
    into v_dropped
  from jsonb_array_elements_text(coalesce(p_payload -> 'subjects', '[]'::jsonb))
       with ordinality as t(slug, ord)
  where not exists (select 1 from public.subjects s where s.slug = t.slug);

  delete from public.tutor_subjects where tutor_id = p_id;
  insert into public.tutor_subjects (tutor_id, subject_id, position)
  select p_id, s.id, (row_number() over (order by t.ord)) - 1
  from jsonb_array_elements_text(coalesce(p_payload -> 'subjects', '[]'::jsonb))
       with ordinality as t(slug, ord)
  join public.subjects s on s.slug = t.slug;

  return jsonb_build_object('dropped_subjects', to_jsonb(v_dropped));
end;
$$;

-- Display name + slug, the step saveTutorProfile used to do with a direct
-- profiles UPDATE and a separate assign_tutor_slug call. The slug is only
-- re-derived on a real rename, so a collision-suffixed URL does not churn.
create or replace function public._apply_tutor_name(p_id uuid, p_name text)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_old  text;
begin
  if v_name = '' then
    raise exception 'Your full name is required.' using errcode = '22023';
  end if;
  select full_name into v_old from public.profiles where id = p_id for update;
  if v_old is distinct from v_name then
    update public.profiles set full_name = v_name where id = p_id;
  end if;
  if btrim(coalesce(v_old, '')) = v_name then
    return false;
  end if;
  perform public._assign_tutor_slug(p_id, v_name);
  return true;
end;
$$;

revoke all on function public._require_own_tutor()                         from public, anon, authenticated;
revoke all on function public._atar_from_credentials(jsonb)                from public, anon, authenticated;
revoke all on function public._valid_profile_image(text, text, uuid)       from public, anon, authenticated;
revoke all on function public._apply_tutor_payload(uuid, jsonb, boolean)   from public, anon, authenticated;
revoke all on function public._apply_tutor_name(uuid, text)                from public, anon, authenticated;

-- 2. save_tutor_profile -------------------------------------------------------
create or replace function public.save_tutor_profile(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid  := public._require_own_tutor();
  v_profile jsonb := coalesce(p_payload -> 'profile', '{}'::jsonb);
  v_avatar  text;
  v_banner  text;
begin
  select avatar_url, banner_url into v_avatar, v_banner
    from public.tutor_profiles where id = v_id;

  if not public._valid_profile_image(nullif(v_profile ->> 'avatar_url', ''), v_avatar, v_id)
     or not public._valid_profile_image(nullif(v_profile ->> 'banner_url', ''), v_banner, v_id) then
    raise exception 'That photo could not be saved. Please upload it again.'
      using errcode = '22023', hint = 'invalid_image_url';
  end if;

  -- Optional so the app deployed before this migration (which sends no
  -- full_name and renames through its own calls) keeps working until 0071.
  if p_payload ? 'full_name' then
    perform public._apply_tutor_name(v_id, p_payload ->> 'full_name');
  end if;

  return public._apply_tutor_payload(v_id, p_payload, true);
end;
$$;

revoke all     on function public.save_tutor_profile(jsonb) from public, anon;
grant  execute on function public.save_tutor_profile(jsonb) to authenticated;

-- 3. save_partner_tutor_profile (0065), now also credentials + atar -----------
-- saveCompanyTutor used to follow this RPC with a direct
--   update tutor_profiles set credentials = …, atar = …
-- through 0065's partner write policy. 0071 drops that policy, so the two
-- columns move in here and the save becomes one transaction.
create or replace function public.save_partner_tutor_profile(p_tutor_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile jsonb := coalesce(p_payload -> 'profile', '{}'::jsonb);
  v_name    text  := btrim(coalesce(p_payload ->> 'name', ''));
  v_creds   jsonb;
  v_avatar  text;
  v_dropped text[] := '{}';
begin
  if not public.partner_owns_tutor(p_tutor_id) then
    raise exception 'not your tutor' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'a name is required' using errcode = '22023';
  end if;

  select avatar_url, credentials into v_avatar, v_creds
    from public.tutor_profiles where id = p_tutor_id for update;

  -- A company tutor's photo is uploaded into the OWNER's folder
  -- (CompanyTutorModal), and the owner is the caller.
  if not public._valid_profile_image(nullif(v_profile ->> 'avatar_url', ''), v_avatar, auth.uid()) then
    raise exception 'That photo could not be saved. Please upload it again.'
      using errcode = '22023', hint = 'invalid_image_url';
  end if;

  -- Absent key = keep what is stored, so an older client that does not send
  -- credentials cannot wipe them.
  if p_payload -> 'profile' ? 'credentials' then
    v_creds := coalesce(v_profile -> 'credentials', '[]'::jsonb);
  end if;

  update public.profiles set full_name = v_name where id = p_tutor_id;

  update public.tutor_profiles set
    bio         = nullif(v_profile ->> 'bio', ''),
    bio_long    = nullif(v_profile ->> 'bio_long', ''),
    avatar_url  = nullif(v_profile ->> 'avatar_url', ''),
    avatar_bg   = nullif(v_profile ->> 'avatar_bg', ''),
    initials    = nullif(v_profile ->> 'initials', ''),
    year_min    = coalesce(nullif(v_profile ->> 'year_min', '')::int, year_min),
    year_max    = coalesce(nullif(v_profile ->> 'year_max', '')::int, year_max),
    credentials = coalesce(v_creds, '[]'::jsonb),
    atar        = public._atar_from_credentials(v_creds),
    updated_at  = now()
  where id = p_tutor_id;

  -- Subjects: replace-all, resolving slugs server-side, position from order.
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

revoke all     on function public.save_partner_tutor_profile(uuid, jsonb) from public, anon;
grant  execute on function public.save_partner_tutor_profile(uuid, jsonb) to authenticated;

-- 4. The remaining tutor writes, as RPCs --------------------------------------

-- Visibility persists immediately from the owner card, separately from the
-- section saves (and, in a later slice, outside moderation).
create or replace function public.set_tutor_visibility(p_visibility text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public._require_own_tutor();
begin
  if p_visibility is null or p_visibility not in ('public', 'unlisted', 'hidden') then
    raise exception 'invalid visibility' using errcode = '22023';
  end if;
  update public.tutor_profiles set visibility = p_visibility, updated_at = now() where id = v_id;
  return p_visibility;
end;
$$;

create or replace function public.mark_tutor_onboarded()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := public._require_own_tutor();
begin
  update public.tutor_profiles set onboarded = true where id = v_id and not onboarded;
end;
$$;

-- Documents (0034). The file is uploaded to the tutor-docs bucket first (the
-- bucket's own-folder policy scopes that); this registers it. The path must be
-- in the caller's folder (also the table's CHECK) and the object must actually
-- exist, so a row can never point at nothing. The 5-document cap was only
-- enforced in the browser (MAX_TUTOR_DOCS); it is enforced here now.
create or replace function public.add_tutor_document(p_path text, p_title text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := public._require_own_tutor();
  v_title text := btrim(coalesce(p_title, ''));
  v_doc   uuid;
begin
  if v_title = '' or length(v_title) > 200 then
    raise exception 'A document title is required (200 characters at most).' using errcode = '22023';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> v_id::text then
    raise exception 'invalid document path' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'tutor-docs' and name = p_path) then
    raise exception 'That file has not finished uploading.' using errcode = '22023';
  end if;
  if (select count(*) from public.tutor_documents where tutor_id = v_id) >= 5 then
    raise exception 'You can upload up to 5 documents.' using errcode = '22023';
  end if;

  insert into public.tutor_documents (tutor_id, storage_path, title)
  values (v_id, p_path, v_title)
  returning id into v_doc;
  return v_doc;
end;
$$;

create or replace function public.rename_tutor_document(p_id uuid, p_title text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := public._require_own_tutor();
  v_title text := btrim(coalesce(p_title, ''));
begin
  if v_title = '' or length(v_title) > 200 then
    raise exception 'A document title is required (200 characters at most).' using errcode = '22023';
  end if;
  update public.tutor_documents set title = v_title where id = p_id and tutor_id = v_id;
  if not found then
    raise exception 'Could not rename the document.' using errcode = '42501';
  end if;
  return v_title;
end;
$$;

-- Returns the storage path so the client removes exactly the file the row
-- pointed at, rather than one it names itself.
create or replace function public.delete_tutor_document(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := public._require_own_tutor();
  v_path text;
begin
  delete from public.tutor_documents where id = p_id and tutor_id = v_id
  returning storage_path into v_path;
  if v_path is null then
    raise exception 'Could not remove the document.' using errcode = '42501';
  end if;
  return v_path;
end;
$$;

revoke all     on function public.set_tutor_visibility(text)          from public, anon;
revoke all     on function public.mark_tutor_onboarded()              from public, anon;
revoke all     on function public.add_tutor_document(text, text)      from public, anon;
revoke all     on function public.rename_tutor_document(uuid, text)   from public, anon;
revoke all     on function public.delete_tutor_document(uuid)         from public, anon;
grant  execute on function public.set_tutor_visibility(text)          to authenticated;
grant  execute on function public.mark_tutor_onboarded()              to authenticated;
grant  execute on function public.add_tutor_document(text, text)      to authenticated;
grant  execute on function public.rename_tutor_document(uuid, text)   to authenticated;
grant  execute on function public.delete_tutor_document(uuid)         to authenticated;

-- 5. Guards: protected columns RAISE on a direct write ------------------------
-- Same current_user test as 0057/0061: SECURITY DEFINER callers run as the
-- function owner and service_role is neither role, so every legitimate writer
-- (listed in the header) passes. The existing silent pins are kept as they
-- were; the newly protected columns raise, so an attempt fails loudly instead
-- of appearing to succeed. Only a CHANGED value raises, so a write that echoes
-- back an unchanged row still goes through.
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
    if new.partner_id is distinct from old.partner_id then
      raise exception 'protected_column:partner_id' using errcode = '42501';
    end if;
    if new.slug is distinct from old.slug then
      raise exception 'protected_column:slug' using errcode = '42501';
    end if;
    if new.email_confirmed_at is distinct from old.email_confirmed_at then
      raise exception 'protected_column:email_confirmed_at' using errcode = '42501';
    end if;
    -- `onboarded` joins this list in 0071, once markOnboarded stops writing it
    -- directly.
  end if;
  return new;
end;
$$;

create or replace function public.profiles_guard_capabilities()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.can_author_articles  := old.can_author_articles;
    new.can_invite_companies := old.can_invite_companies;

    -- role is set once by choose_role / claim_partner_as; status is the
    -- moderation field flipped by the report-resolve route (0052).
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

-- 6. profile-images limits ----------------------------------------------------
-- 0006 created the bucket with no size or type limit, so the 5 MB / image-only
-- rules lived only in uploadProfileImage. Enforced by Storage itself now. SVG
-- is deliberately not allowed: it can carry script, and this bucket is public.
update storage.buckets
   set file_size_limit    = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'profile-images';

-- 7. Internal / service-only functions: no direct API access ------------------
-- These take an explicit id and must only run from SECURITY DEFINER callers or
-- the service role. Earlier migrations revoked them from PUBLIC only; revoking
-- from anon/authenticated as well removes any direct grant those roles might
-- hold, and is a no-op where they hold none. service_role keeps its grants.
revoke all on function public._assign_tutor_slug(uuid, text)              from public, anon, authenticated;
revoke all on function public._assign_partner_slug(uuid, text)            from public, anon, authenticated;
revoke all on function public.provision_partner_tutor(uuid, uuid, text)   from public, anon, authenticated;
revoke all on function public.claim_partner_as(uuid, uuid)                from public, anon, authenticated;
