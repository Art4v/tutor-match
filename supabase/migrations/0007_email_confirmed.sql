-- ============================================================================
-- tutormatch — slice 7: only list tutors whose email is confirmed
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0006 (in order).
--
-- WHY:
--   The public pages (/, /browse, /tutor/[slug]) filter tutor_profiles by
--   visibility = 'public', which is the default since 0005. But a brand-new
--   signup gets a 'public' row the instant the handle_new_user() trigger runs
--   — BEFORE the user has clicked the confirmation link. So unverified
--   accounts were showing up on /browse.
--
--   Whether an email is confirmed lives in auth.users.email_confirmed_at, and
--   the anon (public) read role cannot read the auth schema. So we mirror that
--   timestamp onto public.tutor_profiles and let the query helpers filter on
--   it — the same app-layer pattern already used for `visibility`.
--
-- WHAT THIS DOES:
--   1. Adds tutor_profiles.email_confirmed_at (a mirror of auth.users).
--   2. Backfills it for existing tutors from auth.users.
--   3. Extends handle_new_user() to copy email_confirmed_at on signup — this
--      is non-null when the project has email confirmation disabled (users are
--      auto-confirmed at creation), so those projects keep working unchanged.
--   4. Adds an AFTER UPDATE trigger on auth.users so that confirming later
--      flips the mirror, making the tutor listable.
--   5. Indexes the new column (the public queries filter on it).
-- ============================================================================

-- 1. Column -------------------------------------------------------------------
alter table public.tutor_profiles
  add column if not exists email_confirmed_at timestamptz;

-- 2. Backfill from auth.users -------------------------------------------------
update public.tutor_profiles tp
set    email_confirmed_at = u.email_confirmed_at
from   auth.users u
where  u.id = tp.id;

-- 3. handle_new_user(): mirror confirmation at insert ------------------------
-- Replaces the version from 0004_browse.sql. Identical behaviour, plus it
-- copies new.email_confirmed_at into the new row.
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
    insert into public.tutor_profiles (id, slug, email_confirmed_at)
    values (new.id, public.generate_unique_slug(v_name), new.email_confirmed_at);
  else
    insert into public.student_profiles (id) values (new.id);
  end if;

  return new;
end;
$$;

-- 4. Mirror confirmation when it happens later --------------------------------
-- Normal flow: the user signs up unconfirmed, clicks the email link, and
-- Supabase UPDATEs auth.users.email_confirmed_at. This trigger propagates that
-- onto the tutor's public row so they become listable on /browse.
create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is distinct from old.email_confirmed_at then
    update public.tutor_profiles
    set    email_confirmed_at = new.email_confirmed_at
    where  id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_email_confirmed();

-- 5. Index --------------------------------------------------------------------
create index if not exists tutor_profiles_email_confirmed_at_idx
  on public.tutor_profiles (email_confirmed_at);
