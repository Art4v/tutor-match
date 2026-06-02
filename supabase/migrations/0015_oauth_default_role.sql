-- ============================================================================
-- tutormatch — slice 15: OAuth-safe signup trigger (default role)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0014 (in order). Replaces the handle_new_user() defined in
--   0013_slug_regen_and_race_safe.sql, preserving the race-safe slug assignment
--   and the email_confirmed_at mirror.
--
-- WHY:
--   Enabling Google OAuth means users can now be created without going through
--   /api/auth/signup, so auth.users.raw_user_meta_data no longer carries our
--   explicit `role`. profiles.role is NOT NULL (enum tutor/student), so the
--   trigger would insert NULL and roll the whole signup back. OAuth providers
--   also vary on whether they send `full_name` vs `name`.
--
-- WHAT THIS DOES:
--   handle_new_user(): identical to the 0013 version except
--     - role defaults to 'tutor' when raw_user_meta_data has no `role`
--       (matches the current tutor-only app; OAuth users land in /settings),
--     - full_name falls back to the `name` claim when `full_name` is absent.
--   Email/password signups still pass `role` + `full_name` explicitly, so their
--   behaviour is unchanged.
--
--   The trigger binding (on_auth_user_created) is untouched —
--   CREATE OR REPLACE FUNCTION re-defines the function in place.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- OAuth signups carry no `role`; default them to 'tutor'. Email/password
  -- signups set it explicitly in /api/auth/signup, so they keep their value.
  v_role public.user_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    'tutor'
  );
  -- Google populates `full_name` (and `name`); fall back to `name` if needed.
  v_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'name'
  );
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
