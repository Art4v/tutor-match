-- ============================================================================
-- tutormatch — slice 48: presence-aware message notifications
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0044_messaging.sql (conversations + cursors + mark_conversation_read),
--   0047_message_notify_throttle.sql (claim_message_notification + notified cursors).
--
-- WHY:
--   0047 throttles message notifications to one per unread streak, but it still
--   emails on the FIRST message even when the recipient is sitting in the thread
--   watching it arrive live over realtime — the "both people actively chatting"
--   case we don't want to email. This slice suppresses the notification while the
--   recipient currently has THAT EXACT conversation open (narrow, per-thread
--   presence; 60s window fed by a 30s client heartbeat). The skip does NOT stamp
--   the notified cursor, so the first message after they leave still notifies
--   them once (0047 behaviour resumes).
--
-- WHAT THIS DOES:
--   * Adds per-participant "last active in this thread" cursors on conversations.
--   * touch_conversation_presence(p_conversation_id): the recipient's client
--     heartbeats this while the thread is open; sets the caller's own active
--     cursor (mirrors mark_conversation_read).
--   * Recreates claim_message_notification (0047 body + one presence check).
-- ============================================================================

-- 1. Per-participant "last active in this thread" cursors -------------------
alter table public.conversations
  add column if not exists student_last_active_at timestamptz,  -- student's client heartbeat while viewing this thread
  add column if not exists tutor_last_active_at   timestamptz;  -- tutor's client heartbeat while viewing this thread

-- 2. touch_conversation_presence() ------------------------------------------
-- Heartbeat: set the caller's own active cursor for a thread they're viewing.
-- Mirrors mark_conversation_read (caller writes only their own side). No-op-safe
-- if the caller isn't a participant.
create or replace function public.touch_conversation_presence(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid := auth.uid();
  v_student uuid;
  v_tutor   uuid;
begin
  if v_id is null then
    return;
  end if;

  select student_id, tutor_id into v_student, v_tutor
    from public.conversations where id = p_conversation_id;
  if not found then
    return;
  end if;

  if v_id = v_student then
    update public.conversations set student_last_active_at = now() where id = p_conversation_id;
  elsif v_id = v_tutor then
    update public.conversations set tutor_last_active_at = now() where id = p_conversation_id;
  end if;
  -- non-participant: silently no-op
end;
$$;

revoke all     on function public.touch_conversation_presence(uuid) from public;
grant  execute on function public.touch_conversation_presence(uuid) to authenticated;

-- 3. claim_message_notification() — 0047 body + presence check --------------
-- After the throttle guard passes, also skip (without stamping) when the
-- recipient is actively viewing this conversation, so we don't email someone who
-- is already watching the message arrive live.
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
  v_active    timestamptz;
begin
  if v_id is null then
    return null;
  end if;

  -- Lock the conversation row so concurrent sends can't both decide to notify,
  -- pulling the recipient's read + notified + active cursors in the one locked read.
  select c.student_id, c.tutor_id,
         case when v_id = c.student_id then c.tutor_last_read_at     else c.student_last_read_at     end,
         case when v_id = c.student_id then c.tutor_last_notified_at else c.student_last_notified_at end,
         case when v_id = c.student_id then c.tutor_last_active_at   else c.student_last_active_at   end
    into v_student, v_tutor, v_read, v_notified, v_active
    from public.conversations c
   where c.id = p_conversation_id
   for update;
  if not found then
    return null;
  end if;

  -- Resolve the recipient (the participant that isn't the caller). v_read /
  -- v_notified / v_active above already hold that recipient's cursors.
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

  -- Recipient is actively viewing THIS conversation? Skip WITHOUT stamping the
  -- notified cursor, so the first message after they leave still notifies them.
  if v_active is not null and v_active > now() - interval '60 seconds' then
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
