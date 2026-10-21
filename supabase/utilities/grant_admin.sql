-- ============================================================================
-- tutormatch — GRANT / REVOKE ADMIN (the only way to do either)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Put the target user's uuid in the set_config(...) line below (one spot).
--   2. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--
-- Don't know the id? Look it up by email first (run this on its own):
--   select id, email from auth.users where email = 'someone@example.com';
--
-- WHAT IT DOES:
--   Sets profiles.is_admin = true (0074), which opens /admin: verification,
--   reviews, reports, profile changes, companies (including invites), users and
--   history. Any role may hold it. A DISABLED account keeps the flag but loses
--   the power: is_admin() also requires profiles.status = 'enabled'.
--
-- THIS IS THE ONLY WAY TO GRANT OR REVOKE IT, by decision. There is no RPC,
--   route or dashboard control that writes is_admin, and the
--   `profiles_guard_capabilities` trigger RAISES if a signed-in user tries.
--   The dashboard also refuses to disable an admin or change their author flag,
--   so demoting or disabling an admin is done here (revoke first, then
--   enable_user.sql's disable block if needed).
--
--   Initial admins (run once per environment): Aarav Bhatt, Eric Chen,
--   Hoguen Cho.
--
--   Requires migration 0074.
--
-- To REVOKE, uncomment the block below instead of the grant.
-- ============================================================================

begin;

-- >>> EDIT THIS LINE: paste the profiles.id (uuid) to grant admin to <<<
select set_config('util.user_id', '00000000-0000-0000-0000-000000000000', false);

update public.profiles
   set is_admin = true
 where id = current_setting('util.user_id')::uuid;

-- Revoke (uncomment to use instead of the update above):
-- update public.profiles
--    set is_admin = false
--  where id = current_setting('util.user_id')::uuid;

commit;

-- Sanity check.
select p.id, p.full_name, p.role, p.status, p.is_admin, p.admin_alerts_muted
from public.profiles p
where p.id = current_setting('util.user_id')::uuid;

-- Every current admin:
-- select p.id, p.full_name, u.email, p.status
-- from public.profiles p join auth.users u on u.id = p.id
-- where p.is_admin order by p.full_name;
