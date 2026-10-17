-- ============================================================================
-- tutormatch — 0071: every tutor write goes through a checked RPC (part 2 of 2)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0070, AND the app deploy that moved every tutor write onto the
--   0070 RPCs. Run it before that deploy and the live app's direct writes
--   (profiles.full_name, assign_tutor_slug, markOnboarded, the document
--   helpers, saveCompanyTutor's credentials update) start failing.
--
-- WHAT THIS DOES:
--   Removes WRITE access only. Every read policy is left exactly as it is:
--     tutor_profiles public read (0055) + partner read (0065); the four child
--     tables' public read (0002); tutor_documents public read (0034); profiles
--     self read, tutor public read, conversation-participant read and partner
--     read; the public reads on the profile-images and tutor-docs buckets and
--     tutor-docs owner select.
--
--   1. "tutor self rw" (0001) is FOR ALL, so dropping it would also take away a
--      tutor's read of their own row. "tutor self read" replaces exactly that
--      read (0055's public read requires an enabled account; this one doesn't,
--      so it is not redundant).
--   2. Drops the tutor self-write policies on the four child tables (0002) and
--      the owner insert/update/delete policies on tutor_documents (0034).
--   3. Drops 0065's company write policies (tutor_profiles, the four child
--      tables, profiles). Company owners now write their tutors only through
--      save_partner_tutor_profile, provision_partner_tutor (service role) and
--      the service-role delete in /api/companies/tutors. The partner READ
--      policies stay, so OwnerCompany still lists and edits its tutors.
--   4. assign_tutor_slug is no longer callable: renames go through
--      save_tutor_profile -> _apply_tutor_name.
--   5. profiles_guard_tutor_name: a tutor's display name can only change
--      through an RPC. "profile self update" (0001) stays, because students
--      rename themselves through it (/account), and with 0070's role/status
--      guard plus this one it can no longer reach anything privileged.
--   6. `onboarded` joins the tutor guard's protected columns.
-- ============================================================================

-- 1. Own-row read in place of the FOR ALL policy ------------------------------
drop policy if exists "tutor self rw" on public.tutor_profiles;
drop policy if exists "tutor self read" on public.tutor_profiles;
create policy "tutor self read"
  on public.tutor_profiles for select
  using (auth.uid() = id);

-- 2. Tutor self-writes ---------------------------------------------------------
drop policy if exists "tutor_subjects self write"   on public.tutor_subjects;
drop policy if exists "tutor_packages self write"   on public.tutor_packages;
drop policy if exists "tutor_experience self write" on public.tutor_experience;
drop policy if exists "tutor_education self write"  on public.tutor_education;

drop policy if exists "tutor_documents owner insert" on public.tutor_documents;
drop policy if exists "tutor_documents owner update" on public.tutor_documents;
drop policy if exists "tutor_documents owner delete" on public.tutor_documents;

-- 3. Company-owner writes (0065) -----------------------------------------------
drop policy if exists "tutor_profiles partner write"   on public.tutor_profiles;
drop policy if exists "tutor_subjects partner write"   on public.tutor_subjects;
drop policy if exists "tutor_packages partner write"   on public.tutor_packages;
drop policy if exists "tutor_experience partner write" on public.tutor_experience;
drop policy if exists "tutor_education partner write"  on public.tutor_education;
drop policy if exists "profiles partner update"        on public.profiles;

-- 4. The old rename RPC ---------------------------------------------------------
revoke all on function public.assign_tutor_slug(text) from public, anon, authenticated;

-- 5. A tutor's name changes only through an RPC --------------------------------
create or replace function public.profiles_guard_tutor_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and old.role = 'tutor'
     and new.full_name is distinct from old.full_name then
    raise exception 'protected_column:full_name' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_tutor_name on public.profiles;
create trigger profiles_guard_tutor_name
  before update on public.profiles
  for each row execute function public.profiles_guard_tutor_name();

-- 6. 0070's tutor guard, plus `onboarded` ---------------------------------------
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
    if new.onboarded is distinct from old.onboarded then
      raise exception 'protected_column:onboarded' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
