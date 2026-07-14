-- ============================================================================
-- tutormatch — slice 51: "has this user blocked me?" check (profile-level)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0049_blocking.sql (blocked_users).
--
-- WHY:
--   conversation_block_state() (0050) reports block state for a CONVERSATION, but
--   a tutor's public profile has no conversation to key off. When a tutor has
--   blocked a student, the student should still see the blocked banner + effects
--   on that tutor's profile ("you've been blocked", no unblock). blocked_users'
--   RLS hides blocks from the blocked party, so this SECURITY DEFINER function
--   answers the single question the profile needs — "has p_user_id blocked me?" —
--   without exposing any other rows.
-- ============================================================================

create or replace function public.is_blocked_by(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
    where blocker_id = p_user_id
      and blocked_id = auth.uid()
  );
$$;

revoke all     on function public.is_blocked_by(uuid) from public;
grant  execute on function public.is_blocked_by(uuid) to authenticated;
