-- ============================================================================
-- tutormatch — slice 56: conversation_list() (bounded conversation summaries)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0044_messaging.sql (conversations + messages + read cursors),
--   0045_message_interactions.sql (messages.unsent_at). Mirrors the SECURITY
--   DEFINER / auth.uid() shape of unread_message_count() (0044/0045).
--
-- WHY:
--   getConversations() (lib/supabase/messaging.js) built the /messages list by
--   downloading EVERY message of EVERY conversation in one unbounded query, then
--   reducing in JS. PostgREST caps a request at 1000 rows by default, so a user
--   with >1000 total messages had the list silently truncated to the newest 1000:
--   conversations whose last message fell outside that window showed "No messages
--   yet" and unread counts were undercounted. It also re-downloaded every body on
--   every list load and every realtime refresh.
--
--   This RPC computes the summary the list needs — one row PER CONVERSATION — server
--   side, so the payload is bounded by the conversation count, not the message count,
--   and nothing truncates.
--
-- WHAT THIS DOES:
--   * conversation_list() returns, for each conversation the caller participates in:
--     the last non-unsent message's body / sender / timestamp (lateral limit 1) and
--     the caller's unread count (messages from the other party, not unsent, newer
--     than the caller's read cursor). SECURITY DEFINER, scoped to auth.uid() being a
--     participant. Ordering + the name/avatar joins stay in getConversations.
-- ============================================================================

create or replace function public.conversation_list()
returns table (
  conversation_id uuid,
  last_body       text,
  last_sender_id  uuid,
  last_created_at timestamptz,
  unread          integer
)
language sql
security definer
set search_path = public
as $$
  select
    c.id,
    lm.body,
    lm.sender_id,
    lm.created_at,
    (
      select count(*)::int
      from public.messages m
      where m.conversation_id = c.id
        and m.unsent_at is null
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(
          case when c.student_id = auth.uid() then c.student_last_read_at
               else c.tutor_last_read_at end,
          '-infinity'::timestamptz
        )
    ) as unread
  from public.conversations c
  left join lateral (
    select m.body, m.sender_id, m.created_at
    from public.messages m
    where m.conversation_id = c.id
      and m.unsent_at is null
    order by m.created_at desc
    limit 1
  ) lm on true
  where c.student_id = auth.uid()
     or c.tutor_id = auth.uid();
$$;

revoke all     on function public.conversation_list() from public;
grant  execute on function public.conversation_list() to authenticated;
