-- ============================================================================
-- tutormatch — slice 47: throttle message notifications (one per unread streak)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0044_messaging.sql (conversations + read cursors + the
--   mark_conversation_read RPC that advances them).
--
-- WHY:
--   Every message currently fires notifyUser (a notifications row + an email)
--   from app/api/messages/send/route.js, so a burst of N messages spams the
--   recipient with N emails. We instead notify the recipient AT MOST ONCE per
--   "unread streak": on the first unread message in a thread, then stay silent
--   until they actually read it (their read cursor advances past our notice),
--   which re-arms the next notification. No scheduler — the decision is made
--   synchronously at send time.
--
-- WHAT THIS DOES:
--   * Adds per-participant "last notified" cursors on conversations, mirroring
--     the existing student_/tutor_last_read_at read cursors.
--   * claim_message_notification(p_conversation_id): one atomic, race-safe call
--     (SELECT ... FOR UPDATE locks the conversation row) that the sender invokes
--     after inserting a message. It decides whether the recipient should be
--     notified, stamps the recipient's notified cursor when so, and returns the
--     recipient's id to notify (or NULL to skip).
-- ============================================================================

-- 1. Per-participant "last notified" cursors --------------------------------
alter table public.conversations
  add column if not exists student_last_notified_at timestamptz,  -- when we last emailed the student about this thread
  add column if not exists tutor_last_notified_at   timestamptz;  -- when we last emailed the tutor about this thread

-- 2. claim_message_notification() -------------------------------------------
-- Called by the message SENDER right after their insert. Returns the recipient
-- (the other participant) when they should be notified, else NULL.
--
-- Should-notify guard: notify iff we have NOT notified the recipient since they
-- last read the thread — recipient_notified IS NULL OR recipient_notified <=
-- coalesce(recipient_read, '-infinity'). So the first unread message notifies
-- (moving notified ahead of read); further messages are suppressed (notified >
-- read) until mark_conversation_read advances read past notified and re-arms it.
--
-- SELECT ... FOR UPDATE serialises two near-simultaneous sends on the same
-- conversation, so exactly one of them notifies. SECURITY DEFINER so the sender
-- can stamp the *recipient's* column (which RLS would not let them write
-- directly), scoped to auth.uid() being a participant.
create or replace function public.claim_message_notification(p_conversation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid := auth.uid();
  v_student   uuid;
  v_tutor     uuid;
  v_recipient uuid;
  v_read      timestamptz;
  v_notified  timestamptz;
begin
  if v_id is null then
    return null;
  end if;

  -- Lock the conversation row so concurrent sends can't both decide to notify,
  -- pulling both sides' read + notified cursors in the one locked read.
  select c.student_id, c.tutor_id,
         case when v_id = c.student_id then c.tutor_last_read_at     else c.student_last_read_at     end,
         case when v_id = c.student_id then c.tutor_last_notified_at else c.student_last_notified_at end
    into v_student, v_tutor, v_read, v_notified
    from public.conversations c
   where c.id = p_conversation_id
   for update;
  if not found then
    return null;
  end if;

  -- Resolve the recipient (the participant that isn't the caller). v_read /
  -- v_notified above already hold that recipient's cursors.
  if v_id = v_student then
    v_recipient := v_tutor;
  elsif v_id = v_tutor then
    v_recipient := v_student;
  else
    return null;  -- caller is not a participant
  end if;

  -- Already notified since they last read? -> suppress.
  if v_notified is not null and v_notified > coalesce(v_read, '-infinity'::timestamptz) then
    return null;
  end if;

  -- Stamp the recipient's notified cursor and tell the caller to notify them.
  if v_recipient = v_tutor then
    update public.conversations set tutor_last_notified_at = now() where id = p_conversation_id;
  else
    update public.conversations set student_last_notified_at = now() where id = p_conversation_id;
  end if;

  return v_recipient;
end;
$$;

revoke all     on function public.claim_message_notification(uuid) from public;
grant  execute on function public.claim_message_notification(uuid) to authenticated;
