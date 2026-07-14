-- ============================================================================
-- tutormatch — slice 50: conversation block state (tell the blocked party)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0044_messaging.sql (conversations) + 0049_blocking.sql (blocked_users).
--
-- WHY:
--   0049 made a block SILENT: blocked_users' RLS only exposes rows where you are
--   the blocker, so the blocked party can't see it and their sends just fail. We
--   now want the blocked party (e.g. a tutor a student blocked) to SEE a closed
--   "you've been blocked" state instead of a mystery failure.
--
--   Rather than broaden the table's RLS (which would let anyone enumerate every
--   account that blocked them), this SECURITY DEFINER RPC reports the block state
--   for ONE conversation the caller participates in — the minimal disclosure the
--   UI needs. It returns two flags:
--     * blocked_by_me    — the caller has blocked the other participant
--     * blocked_by_other — the other participant has blocked the caller
--   Either flag means messaging is frozen (the 0049 INSERT policy already enforces
--   it); the UI uses them to show the right banner / disabled composer.
-- ============================================================================

create or replace function public.conversation_block_state(p_conversation_id uuid)
returns table (blocked_by_me boolean, blocked_by_other boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid := auth.uid();
  v_student uuid;
  v_tutor   uuid;
  v_other   uuid;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;

  select student_id, tutor_id into v_student, v_tutor
    from public.conversations where id = p_conversation_id;
  if not found then
    raise exception 'no such conversation';
  end if;
  if v_id <> v_student and v_id <> v_tutor then
    raise exception 'not a participant';
  end if;

  v_other := case when v_id = v_student then v_tutor else v_student end;

  blocked_by_me := exists (
    select 1 from public.blocked_users where blocker_id = v_id and blocked_id = v_other
  );
  blocked_by_other := exists (
    select 1 from public.blocked_users where blocker_id = v_other and blocked_id = v_id
  );
  return next;
end;
$$;

revoke all     on function public.conversation_block_state(uuid) from public;
grant  execute on function public.conversation_block_state(uuid) to authenticated;
