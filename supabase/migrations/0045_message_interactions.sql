-- ============================================================================
-- tutormatch — slice 45: message interactions (reply · react · edit · unsend)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0044 (in order). Extends public.messages + public.conversations
--   from 0044_messaging.sql. Reuses that file's participant `exists(...)` RLS
--   shape, its SECURITY DEFINER / auth.uid() RPC skeleton, and the guarded
--   supabase_realtime publication block. Models the self-scoped write RLS on
--   0042_saved_tutors.sql (message_reactions is a plain self-RLS write, no RPC).
--
-- WHY:
--   Instagram-style per-message actions on top of the v1 chat:
--     * reply   — a message can quote/point at an earlier one (reply_to_id).
--     * react   — one emoji per user per message (message_reactions).
--     * edit    — the sender can rewrite their own message; edited_at flags it.
--     * unsend  — the sender soft-deletes their own message. It VANISHES for
--                 both participants (filtered out of every read + never shipped
--                 to the browser) but the row + body are RETAINED for admin /
--                 audit. This is why unsend sets a flag rather than DELETEing.
--
--   Edit + unsend go through SECURITY DEFINER RPCs (like start_conversation) so
--   we don't have to open a broad UPDATE policy on messages and can pin exactly
--   which columns change + assert sender = caller. Reactions are a plain
--   self-RLS write (like saved_tutors) so the toggle is a client upsert/delete
--   and Realtime carries a clean, dedicated reaction event stream.
-- ============================================================================

-- 1. Extend messages --------------------------------------------------------
alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists edited_at   timestamptz,   -- non-null => show "Edited"
  add column if not exists unsent_at   timestamptz;   -- non-null => soft-deleted, hidden from reads

create index if not exists messages_reply_to_idx on public.messages (reply_to_id);

-- 2. message_reactions ------------------------------------------------------
-- One reaction per (message, user): the PK enforces "at most one emoji per
-- person per message"; a different emoji is an UPSERT that overwrites, the same
-- emoji again is a DELETE (toggle) — both done client-side under self-RLS.
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id)      on delete cascade,
  emoji      text not null check (btrim(emoji) <> ''),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;

-- RLS: read if you're a participant of the reacted message's conversation;
-- write only your OWN reaction row, and only in a conversation you're part of.
drop policy if exists "message_reactions participants read" on public.message_reactions;
create policy "message_reactions participants read"
  on public.message_reactions for select
  using (exists (
    select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where m.id = message_reactions.message_id
       and (c.student_id = auth.uid() or c.tutor_id = auth.uid())
  ));

drop policy if exists "message_reactions self insert" on public.message_reactions;
create policy "message_reactions self insert"
  on public.message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
        from public.messages m
        join public.conversations c on c.id = m.conversation_id
       where m.id = message_reactions.message_id
         and (c.student_id = auth.uid() or c.tutor_id = auth.uid())
    )
  );

drop policy if exists "message_reactions self update" on public.message_reactions;
create policy "message_reactions self update"
  on public.message_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "message_reactions self delete" on public.message_reactions;
create policy "message_reactions self delete"
  on public.message_reactions for delete
  using (user_id = auth.uid());

-- 3. RPCs: edit + unsend (sender-only, column-pinned) -----------------------
-- edit_message(): the sender rewrites their own, not-yet-unsent message.
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

  update public.messages
     set body = p_body, edited_at = now()
   where id = p_message_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all     on function public.edit_message(uuid, text) from public;
grant  execute on function public.edit_message(uuid, text) to authenticated;

-- unsend_message(): the sender soft-deletes their own message. Body is kept for
-- audit; the read layer filters unsent_at IS NOT NULL so it vanishes for users.
create or replace function public.unsend_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid := auth.uid();
  v_sender uuid;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;

  select sender_id into v_sender from public.messages where id = p_message_id;
  if not found then
    raise exception 'no such message';
  end if;
  if v_sender <> v_id then
    raise exception 'not your message';
  end if;

  update public.messages set unsent_at = now()
   where id = p_message_id and unsent_at is null;
end;
$$;

revoke all     on function public.unsend_message(uuid) from public;
grant  execute on function public.unsend_message(uuid) to authenticated;

-- 4. unread count must ignore unsent messages -------------------------------
-- Recreate 0044's unread_message_count() with an `and m.unsent_at is null`
-- guard, so an unsent message stops inflating the TopNav badge.
create or replace function public.unread_message_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := auth.uid();
  v_count integer;
begin
  if v_id is null then
    return 0;
  end if;

  select count(*)::int into v_count
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.sender_id <> v_id
    and m.unsent_at is null
    and (
      (c.student_id = v_id and m.created_at > coalesce(c.student_last_read_at, '-infinity'::timestamptz))
      or
      (c.tutor_id   = v_id and m.created_at > coalesce(c.tutor_last_read_at,   '-infinity'::timestamptz))
    );

  return coalesce(v_count, 0);
end;
$$;

revoke all     on function public.unread_message_count() from public;
grant  execute on function public.unread_message_count() to authenticated;

-- 5. Realtime ---------------------------------------------------------------
-- messages is already published (0044). Add message_reactions so reaction
-- toggles are delivered live as their own INSERT/UPDATE/DELETE stream, distinct
-- from message UPDATEs (edit/unsend). replica identity full so the change
-- payload carries the columns RLS filters on.
alter table public.message_reactions replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
