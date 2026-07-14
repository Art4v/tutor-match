-- ============================================================================
-- tutormatch — slice 52: account status (enabled / disabled)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0051 (in order). Extends 0044_messaging.sql (messages
--   INSERT policy + start_conversation) and layers on top of the block guards
--   added in 0049_blocking.sql.
--
-- WHY:
--   An admin can DISABLE an account (via the report review flow, slice 53).
--   `profiles.status` defaults to 'enabled' and is flipped to 'disabled' by the
--   service-role resolve route. Being disabled is enforced in three places:
--     1. middleware.js gates every request to the /account-disabled screen.
--     2. A disabled tutor is hidden from public reads (lib/supabase/tutors.js).
--     3. Messaging is frozen STRUCTURALLY here, exactly like a block:
--        - neither party can send while either participant is disabled
--          (messages INSERT policy guard);
--        - a conversation can't be (re)started with a disabled party
--          (start_conversation guard).
--   Keeping the freeze in the DB means it holds even if a disabled user hits an
--   API route directly (middleware exempts /api).
--
-- WHAT THIS DOES:
--   * Adds profiles.status text NOT NULL default 'enabled' CHECK in
--     ('enabled','disabled').
--   * Recreates the messages INSERT policy (0049 body) + a disabled-party guard.
--   * Recreates start_conversation() (0049 body) + a disabled-party guard.
-- ============================================================================

-- 1. Column ------------------------------------------------------------------
alter table public.profiles
  add column if not exists status text not null default 'enabled'
  check (status in ('enabled', 'disabled'));

-- 2. Freeze message sends when either participant is disabled ----------------
-- Recreate 0049's messages INSERT policy verbatim, plus a guard that NEITHER
-- conversation participant is a disabled account. A disable freezes sends both
-- ways, just like a block.
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
    and not exists (
      -- A disabled participant (either side) freezes sends both ways.
      select 1
        from public.conversations c
        join public.profiles p
          on p.id in (c.student_id, c.tutor_id)
       where c.id = conversation_id
         and p.status = 'disabled'
    )
  );

-- 3. Refuse conversation start when either party is disabled -----------------
-- Recreate 0049's start_conversation() verbatim, plus a disabled-party guard
-- alongside the existing block guard.
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

  -- Disabled guard: refuse if either party's account is disabled.
  if exists (
    select 1 from public.profiles p
    where p.id in (v_id, p_tutor_id)
      and p.status = 'disabled'
  ) then
    raise exception 'account disabled';
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
