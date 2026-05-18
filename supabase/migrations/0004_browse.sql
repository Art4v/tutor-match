-- ============================================================================
-- tutormatch — slice 4: public browse (slugs, visibility default, indexes)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON:
--   0001_init.sql, 0002_tutor_profile.sql, 0003_tutor_dashboard.sql.
--
-- WHAT THIS DOES:
--   1. Adds a unique `slug` column to `tutor_profiles` so the public site can
--      route to `/tutor/<slug>` instead of `/tutor/<uuid>`.
--   2. Adds a `generate_unique_slug(name)` helper that lowercases, collapses
--      non-alphanumerics to '-', and appends a numeric suffix on collision.
--   3. Extends `handle_new_user()` to populate the slug for new tutor signups.
--   4. Backfills slugs for any existing tutor_profiles rows.
--   5. Changes `tutor_profiles.visibility` default from 'public' to 'unlisted'
--      so a brand-new (empty) profile doesn't show up on /browse until the
--      tutor has filled in their dashboard and explicitly published. The
--      dashboard's saveTutorProfile() promotes to 'public' on first save.
--   6. Adds indexes on the columns /browse filters by.
--   7. Opens up public read on `profiles` for tutor-role rows only, so the
--      browse page can join `profiles.full_name`. Student profiles stay
--      self-read-only.
-- ============================================================================

-- 1. Slug generation helper ---------------------------------------------------

create or replace function public.generate_unique_slug(p_name text)
returns text
language plpgsql
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

  v_slug := v_base;
  while exists (select 1 from public.tutor_profiles where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  end loop;

  return v_slug;
end;
$$;

-- 2. slug column --------------------------------------------------------------
-- Nullable for safe backfill; the trigger + dashboard ensure new and edited
-- rows always have a slug. Unique constraint means /tutor/<slug> resolves to
-- exactly one tutor.

alter table public.tutor_profiles add column slug text unique;

-- 3. Backfill existing rows ---------------------------------------------------

update public.tutor_profiles tp
set    slug = public.generate_unique_slug(p.full_name)
from   public.profiles p
where  tp.id = p.id
  and  tp.slug is null;

-- 4. Trigger: populate slug on new tutor signup ------------------------------
-- Replaces the version from 0001_init.sql. Same behaviour, plus slug.

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
    insert into public.tutor_profiles (id, slug)
    values (new.id, public.generate_unique_slug(v_name));
  else
    insert into public.student_profiles (id) values (new.id);
  end if;

  return new;
end;
$$;

-- 5. visibility default -> 'unlisted' ----------------------------------------
-- New signups start hidden from /browse. The dashboard's first publish flips
-- this to 'public'. Existing rows are left as-is (no real tutors yet).

alter table public.tutor_profiles
  alter column visibility set default 'unlisted';

-- 6. Indexes for /browse filtering -------------------------------------------
-- tutor_subjects(subject_id) already exists (0002_tutor_profile.sql line 122).

create index on public.tutor_profiles (visibility);
create index on public.tutor_profiles (city);
create index on public.tutor_profiles (atar);
create index on public.tutor_profiles (rate);

-- 7. Public read on profiles, for tutor rows only ----------------------------
-- The /browse page joins tutor_profiles -> profiles to display full_name.
-- 0001_init.sql only allowed self-read; this adds a second SELECT policy
-- (policies OR together) that exposes profiles rows where role='tutor'.
-- Student rows remain visible only to the student themselves.

create policy "profile tutor public read"
  on public.profiles for select
  using (role = 'tutor');
