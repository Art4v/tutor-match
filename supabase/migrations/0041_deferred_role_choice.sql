-- ============================================================================
-- tutormatch — slice 41: deferred role choice (student OAuth) — role after auth
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0040 (in order). Replaces the handle_new_user() defined in
--   0039_profiles_terms_consent.sql; reuses _assign_tutor_slug() from 0013.
--
-- WHY:
--   Google OAuth can't carry a role: signInWithOAuth() writes nothing to
--   auth.users.raw_user_meta_data before handle_new_user() fires, so 0039's
--   coalesce(..., 'tutor') forced EVERY OAuth account to become a tutor. That is
--   why student OAuth was disabled (the signup UI hid Google behind the Tutor
--   chip). Rather than special-case OAuth, role selection is REMOVED from signup
--   and DEFERRED: every new user (email or OAuth) authenticates first, then is
--   forced through a /choose-role page (enforced in middleware) before they can
--   do anything else. profiles.role becomes the single source of truth and is
--   nullable to represent "hasn't chosen yet".
--
-- WHAT THIS DOES:
--   1. Drops NOT NULL on profiles.role (NULL = role not chosen yet). Existing
--      rows keep their role and never see the gate. RLS stays safe: the public
--      read policy (0004) is `using (role = 'tutor')`, and NULL = 'tutor' is NULL
--      (not true), so in-flight NULL-role accounts are never publicly readable.
--   2. handle_new_user(): inserts ONLY the profiles row (role NULL,
--      terms_agreed_at now()). It no longer reads a role or creates a
--      tutor_profiles/student_profiles row — that moves to choose_role().
--   3. choose_role(p_role): the authenticated, one-time RPC the /choose-role page
--      calls. Sets profiles.role and creates the matching extension row (the
--      tutor-creation logic — placeholder slug + _assign_tutor_slug — moved here
--      out of the trigger). Raising if a role is already set makes it safe: a
--      returning user can never re-run it and flip their role.
-- ============================================================================

-- 1. Role becomes nullable ----------------------------------------------------
alter table public.profiles
  alter column role drop not null;

-- ----------------------------------------------------------------------------
-- 2. handle_new_user(): create only the profiles row, with NO role yet.
--    Keeps the OAuth-safe full_name coalesce (metadata full_name -> Google name
--    claim) and the all-roles consent stamp from 0039.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'name');
begin
  -- role is left NULL: the user picks it at /choose-role after authenticating,
  -- which is when the tutor_profiles/student_profiles row is created.
  insert into public.profiles (id, role, full_name, terms_agreed_at)
  values (new.id, null, v_name, now());

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. choose_role(): set the caller's role once and create the extension row.
--    SECURITY DEFINER + auth.uid()-scoped so a caller can only ever set their
--    own role. Raises when a role is already set (one-time; a returning user
--    can never flip their role by calling it again).
-- ----------------------------------------------------------------------------
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
    -- Mirror auth.users.email_confirmed_at like the old trigger did (public
    -- reads filter on it). Insert a guaranteed-unique placeholder slug (the
    -- uuid), then let the race-safe core rewrite it to the name-derived slug.
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
