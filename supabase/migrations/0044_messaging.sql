-- ============================================================================
-- tutormatch — slice 44: messaging (student <-> tutor 1:1 chat)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0043 (in order). Uses student_profiles/tutor_profiles (0001),
--   tutor_profiles.visibility (0003) + email_confirmed_at (0007), profiles.role
--   (0001/0041). Models RLS + the SECURITY DEFINER / auth.uid() RPC skeleton on
--   0021_verification_and_notifications.sql, and the role-table FKs + self-scoped
--   RLS on 0042_saved_tutors.sql.
--
-- WHY:
--   Students need to reach tutors from a tutor's public profile, and both sides
--   need to carry on the conversation afterwards. The direction rule ("a student
--   initiates; a tutor can never reach out first") is enforced structurally, not
--   in app code:
--     1. A conversation can only be CREATED by a student, via start_conversation()
--        (there is no client INSERT policy on conversations). It is created lazily
--        on the student's FIRST message send, so a tutor sees nothing until then.
--     2. The messages INSERT policy lets the tutor post only once a message
--        already exists; only the student can post into an empty conversation, so
--        the first message is always the student's. Afterwards both post freely.
--
-- WHAT THIS DOES:
--   * conversations — one row per (student, tutor) pair (unique). Per-participant
--     read cursors + a last_message_at bumped by trigger. FK'd to the role tables
--     so the student/tutor slots can't be swapped.
--   * messages — one row per message; participants read, participant-insert with
--     the first-message-is-the-student's rule.
--   * profiles / student_profiles participant-read policies so a tutor can read
--     the student's name + avatar of someone they share a conversation with.
--   * start_conversation() / mark_conversation_read() / unread_message_count() RPCs.
--   * both tables added to the supabase_realtime publication for live delivery.
-- ============================================================================

-- 1. Tables -----------------------------------------------------------------
create table if not exists public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references public.student_profiles(id) on delete cascade,
  tutor_id             uuid not null references public.tutor_profiles(id)   on delete cascade,
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz,                 -- bumped by trigger on message insert
  student_last_read_at timestamptz,                 -- per-participant read cursors
  tutor_last_read_at   timestamptz,
  unique (student_id, tutor_id)                     -- one conversation per pair
);

create index if not exists conversations_student_idx
  on public.conversations (student_id, last_message_at desc);
create index if not exists conversations_tutor_idx
  on public.conversations (tutor_id, last_message_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  body            text not null check (btrim(body) <> ''),
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- 2. RLS --------------------------------------------------------------------
-- conversations: participants read; NO insert policy (created only via
-- start_conversation, a SECURITY DEFINER RPC that bypasses RLS); participants
-- may update (read-cursor writes, further guarded by mark_conversation_read).
drop policy if exists "conversations participants read" on public.conversations;
create policy "conversations participants read"
  on public.conversations for select
  using (student_id = auth.uid() or tutor_id = auth.uid());

drop policy if exists "conversations participants update" on public.conversations;
create policy "conversations participants update"
  on public.conversations for update
  using (student_id = auth.uid() or tutor_id = auth.uid())
  with check (student_id = auth.uid() or tutor_id = auth.uid());

-- messages: participants read; insert requires sender = caller, caller is a
-- participant, and (the first message is the student's): the tutor may insert
-- only once a message already exists. We test "a message already exists" via
-- conversations.last_message_at (set by the trigger on the first insert) rather
-- than a subquery on messages itself — a policy that references its own table
-- raises "infinite recursion detected in policy" (42P17). Since only the student
-- can post into an empty (last_message_at IS NULL) conversation, the first
-- message is always theirs.
drop policy if exists "messages participants read" on public.messages;
create policy "messages participants read"
  on public.messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.student_id = auth.uid() or c.tutor_id = auth.uid())
  ));

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
  );

-- Participant-read on the counterpart's identity. The tutor side is already
-- public (profiles tutor-read 0004, tutor_profiles public-read 0002); add the
-- student side so a tutor can read the name + avatar of a student they share a
-- conversation with.
drop policy if exists "profiles read conversation participants" on public.profiles;
create policy "profiles read conversation participants"
  on public.profiles for select
  using (exists (
    select 1 from public.conversations c
    where (c.student_id = auth.uid() and c.tutor_id = profiles.id)
       or (c.tutor_id   = auth.uid() and c.student_id = profiles.id)
  ));

drop policy if exists "student_profiles read for conversation tutor" on public.student_profiles;
create policy "student_profiles read for conversation tutor"
  on public.student_profiles for select
  using (exists (
    select 1 from public.conversations c
    where c.student_id = student_profiles.id and c.tutor_id = auth.uid()
  ));

-- 3. Trigger: keep last_message_at fresh regardless of insert path ----------
create or replace function public.bump_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation on public.messages;
create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_last_message();

-- 4. RPCs -------------------------------------------------------------------
-- start_conversation(): student-only gate, invoked at first-send. Validates the
-- caller is a student and the target is a public, email-confirmed tutor, then
-- find-or-creates the (student, tutor) conversation and returns its id.
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

-- mark_conversation_read(): set the caller's own read cursor. Raises if the
-- caller isn't a participant.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
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
    raise exception 'not authenticated';
  end if;

  select student_id, tutor_id into v_student, v_tutor
    from public.conversations where id = p_conversation_id;
  if not found then
    raise exception 'no such conversation';
  end if;

  if v_id = v_student then
    update public.conversations set student_last_read_at = now() where id = p_conversation_id;
  elsif v_id = v_tutor then
    update public.conversations set tutor_last_read_at = now() where id = p_conversation_id;
  else
    raise exception 'not a participant';
  end if;
end;
$$;

revoke all     on function public.mark_conversation_read(uuid) from public;
grant  execute on function public.mark_conversation_read(uuid) to authenticated;

-- unread_message_count(): total unread across the caller's conversations —
-- messages from the other party newer than the caller's read cursor. Drives the
-- TopNav Messages badge in one round-trip.
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
-- postgres_changes honours RLS for the authenticated browser client, so each
-- user only receives rows from their own conversations. replica identity full
-- ensures the change payload carries the columns RLS filters on.
alter table public.messages      replica identity full;
alter table public.conversations replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
