-- ============================================================================
-- tutormatch — slice 25: Terms of Service / Privacy Policy consent
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0024 (in order). Replaces the handle_new_user() defined in
--   0016_oauth_default_role.sql, preserving the OAuth-safe role/name defaults
--   and the race-safe slug assignment.
--
-- WHY:
--   Users must now agree to the Terms of Service + Privacy Policy. We record the
--   moment of consent as a single timestamp; the app (lib/policy.js) compares it
--   against POLICY_EFFECTIVE_DATE to decide who must (re-)agree.
--
-- WHAT THIS DOES:
--   1. Adds tutor_profiles.terms_agreed_at (nullable). Existing rows stay NULL,
--      so PolicyConsentGate re-prompts them on next load.
--   2. Stamps every NEW tutor with terms_agreed_at = now() in handle_new_user(),
--      covering both email/password signups (who tick the box) and OAuth signups
--      (who see the implicit notice) — so new accounts never hit the modal.
--   3. accept_current_terms(): a self-scoped RPC the consent modal calls to stamp
--      now() server-side (the client can't backdate it).
-- ============================================================================

alter table public.tutor_profiles
  add column if not exists terms_agreed_at timestamptz;

-- ----------------------------------------------------------------------------
-- handle_new_user(): same body as 0016, plus terms_agreed_at = now() on the
-- tutor_profiles insert.
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
  insert into public.profiles (id, role, full_name)
  values (new.id, v_role, v_name);

  if v_role = 'tutor' then
    -- Insert with a guaranteed-unique placeholder slug (the uuid), then let the
    -- race-safe core rewrite it to the name-derived slug.
    insert into public.tutor_profiles (id, slug, email_confirmed_at, terms_agreed_at)
    values (new.id, new.id::text, new.email_confirmed_at, now());
    perform public._assign_tutor_slug(new.id, v_name);
  else
    insert into public.student_profiles (id) values (new.id);
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- accept_current_terms(): stamp the caller's consent. Scoped to auth.uid() so a
-- tutor can only agree on their own behalf; SECURITY DEFINER + now() means the
-- timestamp is server-set and can't be forged/backdated by the client.
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

  update public.tutor_profiles
     set terms_agreed_at = now()
   where id = auth.uid();
end;
$$;

grant execute on function public.accept_current_terms() to authenticated;
