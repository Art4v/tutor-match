-- ============================================================================
-- tutormatch — DELETE A COMPANY (admin action, permanent)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Put the company's slug in the set_config(...) line below (one spot).
--   2. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--
-- Want to see what will go first? Run this on its own:
--   select p.id, p.name, p.slug, p.visibility, p.owner_id,
--          (select count(*) from public.tutor_profiles t where t.partner_id = p.id) as tutors,
--          (select count(*) from public.reviews r where r.partner_id = p.id) as reviews
--   from public.partners p where p.slug = 'the-slug';
--
-- WHAT IT DOES, in order, in one transaction:
--   1. Deletes each company tutor's SHADOW auth user (0065). This has to come
--      first: the partners row cascades DOWN to tutor_profiles, but that would
--      leave the auth.users + profiles rows above each tutor orphaned. Deleting
--      from auth.users cascades cleanly through profiles -> tutor_profiles,
--      the same thing DELETE /api/companies/tutors does per tutor.
--   2. Resets the owner's profiles.role to NULL (claimed companies only). The
--      account is KEPT. Left as 'partner' it would have no company, /company
--      would bounce it to "/" forever, and choose_role() refuses an account
--      that already has a role. NULL sends them through /choose-role on their
--      next sign-in (0041) so they can become a tutor or student.
--   3. Deletes the partners row, which cascades to partner_packages and the
--      company's reviews (0067).
--
-- If the slug matches nothing, it raises and nothing is changed.
--
-- NOT CLEANED UP: the logo / banner files in Storage (profile-images), the
--   same accepted gap as delete_own_account (0015). Storage objects can't be
--   deleted from SQL anyway (storage.protect_delete(), see 0034); remove them
--   in the dashboard if you care. The URLs are printed by the preview above
--   if you add logo_url, banner_url to its select.
--
-- Requires migrations 0063 – 0067.
-- ============================================================================

begin;

-- >>> EDIT THIS LINE — paste the slug of the company to delete <<<
select set_config('util.company_slug', 'the-slug', false);

do $$
declare
  v_company public.partners%rowtype;
  v_tutors  int;
begin
  select * into v_company
  from public.partners
  where slug = current_setting('util.company_slug');

  if not found then
    raise exception 'No company with slug %', current_setting('util.company_slug');
  end if;

  -- 1. Shadow tutor accounts.
  delete from auth.users u
  using public.tutor_profiles t
  where t.id = u.id
    and t.partner_id = v_company.id;
  get diagnostics v_tutors = row_count;

  -- 2. Owner keeps their login, loses the role. Only touch a 'partner' role,
  --    so an owner who somehow holds another role is not silently demoted.
  if v_company.owner_id is not null then
    update public.profiles
       set role = null
     where id = v_company.owner_id
       and role = 'partner';
  end if;

  -- 3. The company itself (+ packages and reviews by cascade).
  delete from public.partners where id = v_company.id;

  raise notice 'Deleted % (%): % tutor(s). Owner: %',
    v_company.name, v_company.slug, v_tutors,
    coalesce(v_company.owner_id::text, 'unclaimed');
end $$;

commit;

-- Sanity check — should return no rows.
select id, name, slug
from public.partners
where slug = current_setting('util.company_slug');
