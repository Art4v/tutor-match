-- ============================================================================
-- tutormatch — GRANT / REVOKE COMPANY INVITING (admin action)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Put the target user's uuid in the set_config(...) line below (one spot).
--   2. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--
-- Don't know the id? Look it up by email first (run this on its own):
--   select id, email from auth.users where email = 'someone@example.com';
--
-- WHAT IT DOES:
--   Sets profiles.can_invite_companies = true (0068), which is what lets someone
--   use /companies/invite: create a company page (hidden until claimed), copy
--   its claim link, and see every company with its claim status. Everything
--   else about the account is untouched.
--
-- THIS IS THE ONLY WAY TO GRANT IT, and that is deliberate. The
--   `profiles_guard_capabilities` BEFORE UPDATE trigger (0061, extended in 0068)
--   pins this column whenever current_user is 'authenticated' or 'anon', so a
--   signed-in user cannot grant it to themselves from the browser. The SQL
--   editor runs as a superuser role, so it passes the guard.
--
--   Any role works (unlike authoring, nothing here has a foreign key to
--   tutor_profiles). A DISABLED account keeps the flag but loses the power:
--   _is_company_inviter() also requires profiles.status = 'enabled'.
--
--   Requires migration 0068.
--
-- To REVOKE, uncomment the block below. Companies that person already created
-- stay exactly as they are; only their access to /companies/invite goes.
-- ============================================================================

begin;

-- >>> EDIT THIS LINE: paste the profiles.id (uuid) to grant inviting to <<<
select set_config('util.user_id', '00000000-0000-0000-0000-000000000000', false);

update public.profiles
   set can_invite_companies = true
 where id = current_setting('util.user_id')::uuid;

-- Revoke (uncomment to use instead of the update above):
-- update public.profiles
--    set can_invite_companies = false
--  where id = current_setting('util.user_id')::uuid;

commit;

-- Sanity check.
select p.id,
       p.full_name,
       p.role,
       p.status,
       p.can_invite_companies,
       (select count(*) from public.partners pa where pa.created_by = p.id) as companies_invited
from public.profiles p
where p.id = current_setting('util.user_id')::uuid;
