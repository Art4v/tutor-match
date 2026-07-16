-- ============================================================================
-- tutormatch — slice 49: blocking (student <-> tutor mutual block)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0048 (in order). Extends the messaging tables from
--   0044_messaging.sql (conversations + messages + start_conversation), and
--   models the self-scoped write RLS on 0042_saved_tutors.sql.
--
-- WHY:
--   Either party in a conversation can BLOCK the other. A block is silent (the
--   blocked user is never told) and reversible (Unblock deletes the row). It is
--   enforced STRUCTURALLY, not in app code:
--     1. Neither side can send new messages while a block exists in EITHER
--        direction between the two participants (messages INSERT policy guard).
--     2. A blocked user can't (re)start a conversation with the blocker
--        (start_conversation guard) — covers the case where the block predates
--        any conversation row, or the student tries to reopen from ?to=<slug>.
--   The blocker's own client hides the thread; the DB guarantees the freeze.
--
-- WHAT THIS DOES:
--   * blocked_users — one row per (blocker, blocked) pair. Self-RLS writes (no
--     RPC): block = insert your own row, unblock = delete it.
--   * Recreates the messages INSERT policy (0044) with a two-directional block
--     guard.
--   * Recreates start_conversation() (0044) with the same block guard.
-- ============================================================================

-- 1. Table ------------------------------------------------------------------
create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),          -- idempotent block
  check (blocker_id <> blocked_id)               -- can't block yourself
);

-- Reverse lookup: "who has blocked me / this user" (used by the policy guards
-- and could back a future block-list view).
create index if not exists blocked_users_blocked_idx
  on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

-- 2. RLS: self-scoped on blocker_id ----------------------------------------
-- You may read, create, and delete only YOUR OWN block rows (the ones where you
-- are the blocker). There is deliberately no policy exposing rows where you are
-- the blocked_id — a block stays invisible to the person blocked.
drop policy if exists "blocked_users self read" on public.blocked_users;
create policy "blocked_users self read"
  on public.blocked_users for select
  using (blocker_id = auth.uid());

drop policy if exists "blocked_users self insert" on public.blocked_users;
create policy "blocked_users self insert"
  on public.blocked_users for insert
  with check (blocker_id = auth.uid());

drop policy if exists "blocked_users self delete" on public.blocked_users;
create policy "blocked_users self delete"
  on public.blocked_users for delete
  using (blocker_id = auth.uid());

-- 3. Enforce blocks on message sends ---------------------------------------
-- Recreate 0044's messages INSERT policy verbatim, plus a guard that NO block
-- exists in either direction between the conversation's two participants. A
-- block freezes sends BOTH ways (blocker and blocked alike can't post).
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
    and not exists (
      -- Any block between the two participants (either direction) freezes sends.
      select 1
        from public.conversations c
        join public.blocked_users b
          on (b.blocker_id = c.student_id and b.blocked_id = c.tutor_id)
          or (b.blocker_id = c.tutor_id   and b.blocked_id = c.student_id)
       where c.id = conversation_id
    )
  );

-- 4. Enforce blocks on conversation start ----------------------------------
-- Recreate 0044's start_conversation() verbatim, plus a block guard so a
-- blocked student can't (re)open a thread with the blocker via ?to=<slug>.
create or replace function public.start_conversation(p_tutor_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid := auth.uid();
  v_role public.user_role;
  v_conv uuid;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;
  if p_tutor_id is null then
    raise exception 'tutor is required';
  end if;

  select role into v_role from public.profiles where id = v_id;
  if v_role is distinct from 'student' then
    raise exception 'only students can start conversations';
  end if;

  if not exists (
    select 1 from public.tutor_profiles t
    where t.id = p_tutor_id
      and t.visibility = 'public'
      and t.email_confirmed_at is not null
  ) then
    raise exception 'tutor is not available';
  end if;

  -- Block guard: refuse if either party has blocked the other.
  if exists (
    select 1 from public.blocked_users b
    where (b.blocker_id = v_id       and b.blocked_id = p_tutor_id)
       or (b.blocker_id = p_tutor_id and b.blocked_id = v_id)
  ) then
    raise exception 'conversation blocked';
  end if;

  insert into public.conversations (student_id, tutor_id)
  values (v_id, p_tutor_id)
  on conflict (student_id, tutor_id)
    do update set student_id = excluded.student_id   -- no-op, forces RETURNING
  returning id into v_conv;

  return v_conv;
end;
$$;

revoke all     on function public.start_conversation(uuid) from public;
grant  execute on function public.start_conversation(uuid) to authenticated;
