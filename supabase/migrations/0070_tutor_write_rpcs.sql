-- ============================================================================
-- 0070_tutor_write_rpcs: every tutor profile write goes through an RPC
-- ============================================================================
-- First slice of profile re-approval (verified tutors' edits will need an admin
-- to approve them before they go live). Nothing is gated yet; this migration
-- only makes a gate POSSIBLE, by closing every path that writes public tutor
-- data without going through a function we control.
--
-- THE HOLE IT CLOSES. 0001's "tutor self rw" is `for all using (auth.uid() = id)`
-- with no column restriction, so from the browser console a tutor could run
--   supabase.from('tutor_profiles').update({ verification_status: 'verified' })
-- and verify themselves. 0057's guard trigger only pinned rating/review_count.
-- The four child tables (0002) and tutor_documents (0034) were self-writable the
-- same way, `profiles.full_name` is self-writable through "profile self update"
-- (0001), and `assign_tutor_slug` (0013) renames the slug on its own. Any one of
-- those is a way round an approval gate built only in an RPC.
--
-- WHAT IT DOES
--   1. Splits save_tutor_profile's body into two internal helpers that take an
--      explicit tutor id, so the later approve step (service-role, no session)
--      can apply a payload to someone else's row with the exact same code:
--        _apply_tutor_payload(id, payload, apply_visibility)
--        _apply_tutor_name(id, name)   (name + race-safe slug, 0013)
--   2. Re-creates save_tutor_profile on top of them. The name now rides IN the
--      payload (`full_name`), so name, slug and profile commit together instead
--      of the name being written outside the transaction. A payload without
--      `full_name` skips the name step, so the pre-0070 client keeps working
--      for everything except a rename.
--   3. Folds tutor_documents into the same payload (optional `documents` key),
--      so documents save in the same transaction as everything else and the
--      later approve step applies them through the same code. Adds the two
--      small RPCs that replace the remaining direct writes:
--      set_tutor_visibility and mark_tutor_onboarded.
--   4. Drops the client write policies ("tutor self rw", the four child-table
--      "self write" policies, the tutor_documents owner write policies), adding
--      back a self-SELECT on tutor_profiles: "tutor self rw" was FOR ALL, so it
--      was also how an owner read their own row when 0055's public read hides
--      it (a disabled account).
--   5. Extends tutor_profiles_guard_derived (0057) to pin every server-owned
--      column, and adds profiles_guard_tutor_name. The 0065 partner write
--      policies stay (company tutors are not gated), and the extended guard is
--      what stops a company owner setting verification_status on its tutors.
--   6. Revokes assign_tutor_slug from client roles.
--
-- DEPLOY: apply together with the app change that calls these RPCs. In the gap
-- between the two, the old client's rename, onboarding-complete and document
-- writes fail (the ordinary profile save keeps working).
-- Additive after 0069.
-- ============================================================================

-- 1a. Apply a save payload to a given tutor ----------------------------------
-- The 0037 save_tutor_profile body, unchanged except that the id is a parameter
-- and visibility is only written when asked. Internal: execute is revoked from
-- every client role below, because it takes an arbitrary id.
create or replace function public._apply_tutor_payload(
  p_id uuid,
  p_payload jsonb,
  p_apply_visibility boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile jsonb := coalesce(p_payload -> 'profile', '{}'::jsonb);
  v_service jsonb := v_profile -> 'service_area';
  v_dropped text[] := '{}';
  v_docs    jsonb;
  v_removed text[] := '{}';
begin
  -- At most one ATAR credential: the ATAR doubles as the /browse filter value,
  -- so a second one is ambiguous (0036).
  if (select count(*)
        from jsonb_array_elements(coalesce(v_profile -> 'credentials', '[]'::jsonb)) e
        where e ->> 'icon' = 'atar') > 1 then
    raise exception 'Only one ATAR credential is allowed';
  end if;

  -- 1. Scalar columns. verification_status is intentionally NOT writable here:
  --    a tutor must not be able to self-verify (0021/0028).
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

  -- 5. tutor_subjects (replace-all). Resolve slug -> subject_id; unknown slugs
  --    are dropped and returned so the UI can warn. Positions stay sequential
  --    over the RESOLVED set, preserving the tutor's chosen order (0014).
  select coalesce(array_agg(slug order by ord), '{}'::text[])
    into v_dropped
  from jsonb_array_elements_text(coalesce(p_payload -> 'subjects', '[]'::jsonb))
       with ordinality as t(slug, ord)
  where not exists (select 1 from public.subjects s where s.slug = slug);

  delete from public.tutor_subjects where tutor_id = p_id;
  insert into public.tutor_subjects (tutor_id, subject_id, position)
  select p_id, s.id, (row_number() over (order by t.ord)) - 1
  from jsonb_array_elements_text(coalesce(p_payload -> 'subjects', '[]'::jsonb))
       with ordinality as t(slug, ord)
  join public.subjects s on s.slug = t.slug;

  -- 6. tutor_documents, only when the payload carries the key. Absent means
  --    "leave documents alone", which is what every non-documentation section
  --    save sends; an empty array means "remove them all".
  --
  --    Matched by id, NOT replace-all: a kept document keeps its id and its
  --    uploaded_at (which is the display order), so only titles update.
  --    Entries are { id, path, title }: an id means an existing row of THIS
  --    tutor's, a null id means a file the client has just uploaded (0034's
  --    CHECK still pins its path to the tutor's own folder). Storage objects
  --    are the client's job, since SQL can't touch them: it uploads before
  --    calling, and removes the paths returned in removed_document_paths after.
  if p_payload ? 'documents' then
    v_docs := coalesce(p_payload -> 'documents', '[]'::jsonb);

    if jsonb_array_length(v_docs) > 5 then
      raise exception 'Up to 5 documents.';
    end if;

    if exists (
      select 1 from jsonb_array_elements(v_docs) e
       where nullif(e ->> 'id', '') is not null
         and not exists (
           select 1 from public.tutor_documents d
            where d.id = (e ->> 'id')::uuid and d.tutor_id = p_id
         )
    ) then
      raise exception 'document not found';
    end if;

    if exists (
      select 1 from jsonb_array_elements(v_docs) e
       where btrim(coalesce(e ->> 'title', '')) = ''
    ) then
      raise exception 'Document titles can''t be empty.';
    end if;

    with gone as (
      delete from public.tutor_documents d
       where d.tutor_id = p_id
         and d.id not in (
           select (e ->> 'id')::uuid
             from jsonb_array_elements(v_docs) e
            where nullif(e ->> 'id', '') is not null
         )
      returning d.storage_path
    )
    select coalesce(array_agg(storage_path), '{}'::text[]) into v_removed from gone;

    update public.tutor_documents d
       set title = btrim(e ->> 'title')
      from jsonb_array_elements(v_docs) e
     where nullif(e ->> 'id', '') is not null
       and d.id = (e ->> 'id')::uuid
       and d.tutor_id = p_id
       and d.title is distinct from btrim(e ->> 'title');

    -- now() is constant within the transaction, so new rows get microsecond
    -- offsets to keep the order the tutor added them in.
    insert into public.tutor_documents (tutor_id, storage_path, title, uploaded_at)
    select p_id,
           e ->> 'path',
           btrim(e ->> 'title'),
           now() + make_interval(secs => ord / 1000000.0)
      from jsonb_array_elements(v_docs) with ordinality as t(e, ord)
     where nullif(e ->> 'id', '') is null;
  end if;

  return jsonb_build_object(
    'dropped_subjects',       to_jsonb(v_dropped),
    'removed_document_paths', to_jsonb(v_removed),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'path', d.storage_path, 'title', d.title)
                       order by d.uploaded_at)
        from public.tutor_documents d
       where d.tutor_id = p_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public._apply_tutor_payload(uuid, jsonb, boolean) from public, anon, authenticated;

-- 1b. Set a tutor's display name, regenerating the slug on a real change -----
-- Returns the (possibly new) slug. The blank check mirrors the 0017 CHECK so
-- the caller gets a readable message rather than a constraint name.
create or replace function public._apply_tutor_name(p_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_old  text;
  v_slug text;
begin
  if v_name = '' then
    raise exception 'Your full name is required.';
  end if;

  select full_name into v_old from public.profiles where id = p_id;

  if btrim(coalesce(v_old, '')) = v_name then
    select slug into v_slug from public.tutor_profiles where id = p_id;
    return v_slug;
  end if;

  update public.profiles set full_name = v_name where id = p_id;
  return public._assign_tutor_slug(p_id, v_name);
end;
$$;

revoke all on function public._apply_tutor_name(uuid, text) from public, anon, authenticated;

-- 2. save_tutor_profile, rebuilt on the helpers -------------------------------
-- Returns { dropped_subjects, removed_document_paths, documents, slug }. `slug`
-- only changes when the payload carried a new name.
create or replace function public.save_tutor_profile(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid := auth.uid();
  v_slug   text;
  v_result jsonb;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.tutor_profiles where id = v_id) then
    raise exception 'no tutor profile for current user';
  end if;

  if p_payload ? 'full_name' then
    v_slug := public._apply_tutor_name(v_id, p_payload ->> 'full_name');
  else
    select slug into v_slug from public.tutor_profiles where id = v_id;
  end if;

  v_result := public._apply_tutor_payload(v_id, p_payload, true);
  return v_result || jsonb_build_object('slug', v_slug);
end;
$$;

revoke all     on function public.save_tutor_profile(jsonb) from public;
grant  execute on function public.save_tutor_profile(jsonb) to authenticated;

-- 3. The small writes that used to go straight at the tables -----------------

-- Visibility on its own, so hiding a profile never has to resend (and, from
-- the next slice, never has to re-submit) the rest of it.
create or replace function public.set_tutor_visibility(p_visibility text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_visibility not in ('public', 'unlisted', 'hidden') then
    raise exception 'invalid visibility';
  end if;
  update public.tutor_profiles
     set visibility = p_visibility, updated_at = now()
   where id = auth.uid();
end;
$$;

revoke all     on function public.set_tutor_visibility(text) from public;
grant  execute on function public.set_tutor_visibility(text) to authenticated;

-- One-way: there is no path that un-onboards a tutor.
create or replace function public.mark_tutor_onboarded()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.tutor_profiles set onboarded = true where id = auth.uid();
end;
$$;

revoke all     on function public.mark_tutor_onboarded() from public;
grant  execute on function public.mark_tutor_onboarded() to authenticated;

-- 4. Drop the client write policies ------------------------------------------
drop policy if exists "tutor self rw" on public.tutor_profiles;

-- Owner read, which "tutor self rw" used to provide as a side effect of FOR ALL.
drop policy if exists "tutor_profiles self read" on public.tutor_profiles;
create policy "tutor_profiles self read"
  on public.tutor_profiles for select
  using (auth.uid() = id);

drop policy if exists "tutor_subjects self write"   on public.tutor_subjects;
drop policy if exists "tutor_packages self write"   on public.tutor_packages;
drop policy if exists "tutor_experience self write" on public.tutor_experience;
drop policy if exists "tutor_education self write"  on public.tutor_education;

drop policy if exists "tutor_documents owner insert" on public.tutor_documents;
drop policy if exists "tutor_documents owner update" on public.tutor_documents;
drop policy if exists "tutor_documents owner delete" on public.tutor_documents;

-- 5a. Pin every server-owned tutor_profiles column ---------------------------
-- Same function 0057 created, with more pinned columns. Still a pin rather than
-- a raise (see 0057), and still keyed on current_user, so SECURITY DEFINER
-- functions (owner role) and service_role pass through. With "tutor self rw"
-- gone the only client write left is the 0065 company-owner policy, and this is
-- what stops a company owner verifying its tutors or moving them between
-- companies.
create or replace function public.tutor_profiles_guard_derived()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.rating                    := old.rating;
    new.review_count              := old.review_count;
    new.verification_status       := old.verification_status;
    new.verification_requested_at := old.verification_requested_at;
    new.partner_id                := old.partner_id;
    new.slug                      := old.slug;
    new.email_confirmed_at        := old.email_confirmed_at;
    new.onboarded                 := old.onboarded;
  end if;
  return new;
end;
$$;

-- 5b. A tutor's name only changes through save_tutor_profile -----------------
-- "profile self update" (0001) has no column restriction, and full_name is the
-- public profile heading, so a direct write would skip the slug regeneration
-- today and the approval gate from the next slice. This RAISES rather than pins:
-- a pin would make the student name card on /account (which writes full_name
-- directly, legitimately) look like it saved when the caller is a tutor. Company
-- tutors are excluded: their owner renames them through the 0065 policies.
create or replace function public.profiles_guard_tutor_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.full_name is distinct from old.full_name
     and exists (
       select 1 from public.tutor_profiles t
        where t.id = new.id and t.partner_id is null
     ) then
    raise exception 'A tutor''s name can only be changed from their profile editor';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_tutor_name on public.profiles;
create trigger profiles_guard_tutor_name
  before update on public.profiles
  for each row execute function public.profiles_guard_tutor_name();

-- 6. The standalone slug rename is now internal-only --------------------------
-- save_tutor_profile renames through _apply_tutor_name; a slug that changes
-- without the name has no legitimate caller.
revoke all on function public.assign_tutor_slug(text) from public, anon, authenticated;
