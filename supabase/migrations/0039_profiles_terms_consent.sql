-- ============================================================================
-- tutormatch — slice 39: student accounts (v1) — terms consent moves to profiles
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0038 (in order). Replaces the handle_new_user() and
--   accept_current_terms() defined in 0025_terms_consent.sql.
--
-- WHY:
--   Student signup is being enabled (previously the signup UI was tutor-only).
--   The consent system (0025) stored the stamp on tutor_profiles, which made
--   sense while tutors were the only role — but consent is a property of the
--   ACCOUNT, not the role. Rather than mirror the column onto student_profiles
--   and maintain two, the stamp moves to the shared `profiles` table (1:1 with
--   auth.users, exists for every role), so the trigger, the RPC and the gate
--   each touch exactly one column regardless of role.
--
--   Exposure note: `profiles` tutor rows are public-read (0004), so the stamp
--   is readable for tutors — the same exposure it had on tutor_profiles, which
--   is public-read too (0002).
--
-- WHAT THIS DOES:
--   1. Adds profiles.terms_agreed_at, backfills it from tutor_profiles, then
--      drops tutor_profiles.terms_agreed_at (single source of truth).
--   2. handle_new_user(): stamps terms_agreed_at = now() on the profiles
--      insert for every role (email signups tick the box; OAuth signups see
--      the implicit notice).
--   3. accept_current_terms(): now one UPDATE on profiles.
-- ============================================================================

alter table public.profiles
  add column terms_agreed_at timestamptz;

update public.profiles p
   set terms_agreed_at = t.terms_agreed_at
  from public.tutor_profiles t
 where p.id = t.id;

alter table public.tutor_profiles
  drop column terms_agreed_at;

-- ----------------------------------------------------------------------------
-- handle_new_user(): same body as 0025, but the consent stamp lands on the
-- profiles insert (all roles) instead of the tutor_profiles insert.
-- ----------------------------------------------------------------------------
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
  insert into public.profiles (id, role, full_name, terms_agreed_at)
  values (new.id, v_role, v_name, now());

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

-- ----------------------------------------------------------------------------
-- accept_current_terms(): stamp the caller's consent, whichever role they are.
-- Scoped to auth.uid() so a user can only agree on their own behalf; SECURITY
-- DEFINER + now() means the timestamp is server-set and can't be backdated.
-- ----------------------------------------------------------------------------
create or replace function public.accept_current_terms()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
     set terms_agreed_at = now()
   where id = auth.uid();
end;
$$;

grant execute on function public.accept_current_terms() to authenticated;
