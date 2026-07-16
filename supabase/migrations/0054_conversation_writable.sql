-- ============================================================================
-- tutormatch — slice 54: centralise the messaging-write freeze
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0053 (in order). Consolidates the block guard (0049) and the
--   disabled-party guard (0052), and extends them to the 0045 interaction
--   surfaces (edit / unsend / react) that never had either.
--
-- WHY:
--   "May I write into this conversation?" was spelled out independently in five
--   places and the copies drifted:
--     * The messages INSERT policy (0049 -> 0052) tested blocks with a PLAIN
--       subquery on blocked_users. RLS runs that subquery AS THE SENDER, and
--       blocked_users only exposes rows where blocker_id = auth.uid() (0049), so
--       a block created by the OTHER party was invisible: a blocked user could
--       still send into an existing thread. (start_conversation, being SECURITY
--       DEFINER, saw both directions — so only NEW drafts were correctly frozen.)
--     * edit_message / unsend_message / the message_reactions INSERT policy (0045)
--       checked only sender/participant — never block or disabled — so a blocked
--       or disabled user could still push new content into a frozen thread by
--       editing an old message's body or reacting (both delivered live).
--
--   Fix: ONE SECURITY DEFINER predicate, conversation_writable(), owns the whole
--   freeze. Being SECURITY DEFINER it sees blocked_users in BOTH directions
--   (closing the asymmetry); being one function, every write surface enforces the
--   identical rule and a future condition (mute, archive, ...) is added in exactly
--   one place. message_writable() is the by-message sibling for the reactions
--   policy (which keys on message_id, not conversation_id).
--
-- WHAT THIS DOES:
--   * conversation_writable(p_conversation_id) — caller is a participant AND no
--     block in either direction AND neither party disabled.
--   * message_writable(p_message_id) — resolves the message's conversation and
--     delegates to conversation_writable.
--   * Recreates the messages INSERT policy (0052 body) with the two block/disabled
--     subqueries replaced by conversation_writable() (first-message rule kept).
--   * Recreates the message_reactions INSERT policy (0045 body) via message_writable.
--   * Recreates edit_message + unsend_message (0045 bodies) with a freeze guard.
-- ============================================================================

-- 1. The predicates ---------------------------------------------------------
create or replace function public.conversation_writable(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.student_id = auth.uid() or c.tutor_id = auth.uid())   -- caller participates
      and not exists (                                             -- no block, either direction
        select 1 from public.blocked_users b
        where (b.blocker_id = c.student_id and b.blocked_id = c.tutor_id)
           or (b.blocker_id = c.tutor_id   and b.blocked_id = c.student_id)
      )
      and not exists (                                             -- neither party disabled
        select 1 from public.profiles p
        where p.id in (c.student_id, c.tutor_id) and p.status = 'disabled'
      )
  );
$$;

revoke all     on function public.conversation_writable(uuid) from public;
grant  execute on function public.conversation_writable(uuid) to authenticated;

-- By-message sibling: resolve the message's conversation, then delegate. A
-- missing message resolves the inner select to NULL -> conversation_writable(NULL)
-- finds no conversation -> false.
create or replace function public.message_writable(p_message_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.conversation_writable(
    (select conversation_id from public.messages where id = p_message_id)
  );
$$;

revoke all     on function public.message_writable(uuid) from public;
grant  execute on function public.message_writable(uuid) to authenticated;

-- 2. messages INSERT policy: first-message rule + conversation_writable --------
-- Recreate 0052's policy, keeping the "first message is the student's" ordering
-- rule inline (keyed on last_message_at) and replacing its two block/disabled
-- subqueries with a single conversation_writable() call.
drop policy if exists "messages participants insert" on public.messages;
create policy "messages participants insert"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (
          c.student_id = auth.uid()                                       -- student may always post
          or (c.tutor_id = auth.uid() and c.last_message_at is not null)  -- tutor only after a message exists
        )
    )
    and public.conversation_writable(conversation_id)
  );

-- 3. message_reactions write policies: via message_writable --------------------
-- Recreate 0045's self-insert policy: you may react only to your own row AND only
-- when the conversation is writable (participant + not blocked + not disabled).
-- The client toggles a different emoji with an upsert (ON CONFLICT DO UPDATE);
-- Postgres evaluates this INSERT WITH CHECK on the proposed row even on the
-- conflict path, so a frozen conversation already blocks the emoji-swap here.
drop policy if exists "message_reactions self insert" on public.message_reactions;
create policy "message_reactions self insert"
  on public.message_reactions for insert
  with check (
    user_id = auth.uid()
    and public.message_writable(message_reactions.message_id)
  );

-- Also gate a bare UPDATE (a crafted client could change an existing emoji without
-- the insert path) on the same writable check, so no new/changed reaction content
-- reaches a frozen thread. DELETE (un-reacting) stays open — it only removes
-- content, like the sender retracting their own reaction.
drop policy if exists "message_reactions self update" on public.message_reactions;
create policy "message_reactions self update"
  on public.message_reactions for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.message_writable(message_reactions.message_id)
  );

-- 4. edit_message / unsend_message: add the freeze guard -----------------------
-- Recreate 0045's edit_message with a conversation_writable() guard after the
-- sender/unsent checks, so a blocked or disabled sender can't rewrite a body.
create or replace function public.edit_message(p_message_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid := auth.uid();
  v_row public.messages;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'message cannot be empty';
  end if;

  select * into v_row from public.messages where id = p_message_id;
  if not found then
    raise exception 'no such message';
  end if;
  if v_row.sender_id <> v_id then
    raise exception 'not your message';
  end if;
  if v_row.unsent_at is not null then
    raise exception 'message was unsent';
  end if;
  if not public.conversation_writable(v_row.conversation_id) then
    raise exception 'conversation is frozen';
  end if;

  update public.messages
     set body = p_body, edited_at = now()
   where id = p_message_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all     on function public.edit_message(uuid, text) from public;
grant  execute on function public.edit_message(uuid, text) to authenticated;

-- Recreate 0045's unsend_message with the same freeze guard. Per the plan the
-- freeze covers all three interactions, so a blocked/disabled sender can't retract
-- either (the audit copy is retained regardless).
create or replace function public.unsend_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid := auth.uid();
  v_sender uuid;
  v_conv   uuid;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;

  select sender_id, conversation_id into v_sender, v_conv
    from public.messages where id = p_message_id;
  if not found then
    raise exception 'no such message';
  end if;
  if v_sender <> v_id then
    raise exception 'not your message';
  end if;
  if not public.conversation_writable(v_conv) then
    raise exception 'conversation is frozen';
  end if;

  update public.messages set unsent_at = now()
   where id = p_message_id and unsent_at is null;
end;
$$;

revoke all     on function public.unsend_message(uuid) from public;
grant  execute on function public.unsend_message(uuid) to authenticated;
