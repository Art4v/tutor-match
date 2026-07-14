-- ============================================================================
-- tutormatch — RE-ENABLE ONE ACCOUNT BY ID (admin shortcut)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Put the target account's uuid in the set_config(...) line below.
--   2. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--
-- Don't know the id? Look it up by email first (run this on its own):
--   select id, email from auth.users where email = 'someone@example.com';
--
-- WHAT IT DOES:
--   Flips profiles.status back to 'enabled' (see 0052). Disabling an account is
--   deliberately ONE-WAY in the app (the report review screen can only disable;
--   the "Request review" appeal flow ships later) — this is the manual reverse.
--   On their next request the middleware disabled-gate (middleware.js) stops
--   redirecting them to /account-disabled, and a re-enabled tutor reappears in
--   public reads (lib/supabase/tutors.js).
--
--   It does NOT touch the reports row that led to the disable (its status stays
--   'resolved') and sends no notification/email.
--
-- To DISABLE instead, set status='disabled' on the same row (uncomment below).
-- ============================================================================

begin;

-- >>> EDIT THIS LINE — paste the profiles.id (uuid) to re-enable <<<
select set_config('util.user_id', '00000000-0000-0000-0000-000000000000', false);

update public.profiles
   set status = 'enabled'
 where id = current_setting('util.user_id')::uuid;

-- Disable (uncomment to use instead of the update above):
-- update public.profiles
--    set status = 'disabled'
--  where id = current_setting('util.user_id')::uuid;

commit;

-- Sanity check — confirm the new state.
select p.id, p.role, p.status
from public.profiles p
where p.id = current_setting('util.user_id')::uuid;
