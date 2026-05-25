-- ============================================================================
-- tutormatch — slice 13: race-safe slug assignment + regenerate slug on rename
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0012 (in order). In particular it replaces the
--   handle_new_user() defined in 0007_email_confirmed.sql, preserving the
--   email_confirmed_at mirroring.
--
-- WHY:
--   1. The old slug path (generate_unique_slug() -> insert) computes a candidate
--      with a SELECT and then inserts it. Two concurrent signups with the same
--      name can both compute 'amelia-tran-2' before either commits; the unique
--      constraint then makes the second insert fail and rolls back that signup.
--   2. Slugs were assigned once at signup and never refreshed, so renaming a
--      profile left a stale, name-mismatched URL (e.g. a signup typo persisted).
--
-- WHAT THIS DOES:
--   1. _assign_tutor_slug(id, name): the race-safe core. Builds a base slug and
--      UPDATEs the row in a retry loop that catches unique_violation and bumps
--      the numeric suffix (with a random-suffix fallback to guarantee it ends).
--      Execute is revoked from the API roles — it takes an explicit id and must
--      never be reachable with an arbitrary one. Only the signup trigger and the
--      auth-checked wrapper (both owned by the same role) call it.
--   2. assign_tutor_slug(name): the authenticated RPC the app calls on rename.
--      It derives the target id from auth.uid(), so a caller can only ever
--      change their OWN slug.
--   3. handle_new_user(): now inserts the tutor row with a placeholder slug (the
--      uuid) and then calls the race-safe core. Still mirrors email_confirmed_at
--      exactly as 0007 did.
--
--   generate_unique_slug() from 0004 is left in place (now unused by the trigger)
--   so nothing that references it by name breaks.
-- ============================================================================

-- 1. Race-safe core -----------------------------------------------------------
-- SECURITY DEFINER so it can write regardless of the caller's RLS, but execute
-- is revoked from the API roles below: it takes an explicit id and must never be
-- reachable with an arbitrary one. The signup trigger and the auth-checked
-- wrapper (both owned by the same role) are the only callers.
create or replace function public._assign_tutor_slug(p_id uuid, p_name text)
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
  -- Lowercase, replace non-alphanumeric runs with '-', trim leading/trailing '-'.
  v_base := regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  if v_base = '' then
    v_base := 'tutor';
  end if;

  loop
    v_slug := case when v_n = 1 then v_base else v_base || '-' || v_n::text end;
    begin
      update public.tutor_profiles set slug = v_slug where id = p_id;
      return v_slug;
    exception when unique_violation then
      -- Another row already holds this slug (it committed while we waited on the
      -- unique index). Bump the suffix and try again.
      v_n := v_n + 1;
      if v_n > 50 then
        -- Pathological contention — guarantee termination with a random suffix.
        v_slug := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
        update public.tutor_profiles set slug = v_slug where id = p_id;
        return v_slug;
      end if;
    end;
  end loop;
end;
$$;

-- Lock the core down: anon/authenticated must not be able to call it via the API
-- with someone else's id. Owner + SECURITY DEFINER callers keep access.
revoke all on function public._assign_tutor_slug(uuid, text) from public;

-- 2. Authenticated rename RPC -------------------------------------------------
-- The app calls this from saveTutorProfile() when the display name changes. The
-- target is always auth.uid(), so it can only ever rewrite the caller's own slug.
create or replace function public.assign_tutor_slug(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := auth.uid();
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.tutor_profiles where id = v_id) then
    raise exception 'no tutor profile for current user';
  end if;
  return public._assign_tutor_slug(v_id, p_name);
end;
$$;

-- 3. Signup trigger: insert placeholder, then assign race-safely -------------
-- Replaces the version from 0007_email_confirmed.sql. Same behaviour (including
-- the email_confirmed_at mirror), except the slug is now assigned through the
-- race-safe core instead of generate_unique_slug() at insert time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := (new.raw_user_meta_data ->> 'role')::public.user_role;
  v_name text := new.raw_user_meta_data ->> 'full_name';
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, v_role, v_name);

  if v_role = 'tutor' then
    -- Insert with a guaranteed-unique placeholder slug (the uuid), then let the
    -- race-safe core rewrite it to the name-derived slug.
    insert into public.tutor_profiles (id, slug, email_confirmed_at)
    values (new.id, new.id::text, new.email_confirmed_at);
    perform public._assign_tutor_slug(new.id, v_name);
  else
    insert into public.student_profiles (id) values (new.id);
  end if;

  return new;
end;
$$;
