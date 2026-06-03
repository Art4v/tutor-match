-- ============================================================================
-- tutormatch — slice 16: OAuth-safe signup trigger (default role + name claim)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0015 (in order). Replaces the handle_new_user() defined in
--   0013_slug_regen_and_race_safe.sql, preserving the race-safe slug assignment
--   and the email_confirmed_at mirror.
--
-- WHY:
--   Google (OAuth) signups don't pass through /api/auth/signup, so their
--   auth.users.raw_user_meta_data carries no 'role' and no 'full_name' — only
--   Google's 'name' claim. profiles.role is NOT NULL, so the unchanged trigger
--   would fail the OAuth insert outright.
--
-- WHAT THIS DOES:
--   Same body as 0013, with two OAuth-safe defaults in the declare block:
--     1. v_role defaults to 'tutor' when no role metadata is present.
--     2. v_name falls back to Google's 'name' claim when 'full_name' is
--        absent/blank (nullif so a blank string doesn't win the coalesce).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role, 'tutor');
  v_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'name');
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
