-- ============================================================================
-- tutormatch — slice 42: saved tutors (student bookmarks)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0041 (in order). student_profiles/tutor_profiles from 0001.
--
-- WHY:
--   Students can browse tutors but have no way to bookmark ones they like. The
--   TopNav "Saved tutors" item was a v1 placeholder. This ships the real store:
--   a student <-> tutor join table the bookmark button writes to, and the
--   /browse ?saved=1 filter reads from.
--
-- WHAT THIS DOES:
--   Creates public.saved_tutors — one row per (student, saved tutor) — keyed on
--   the same auth.users id both role tables share. Composite PK (student_id,
--   tutor_id) makes a save idempotent (no dup rows). Self-only RLS on
--   student_id: a student reads/writes only their own saves; nobody else sees
--   them. No RPC / service-role needed — these are plain RLS-scoped writes.
-- ============================================================================

create table if not exists public.saved_tutors (
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  tutor_id   uuid not null references public.tutor_profiles(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, tutor_id)
);

-- The "my saved tutors" list reads by student, newest first.
create index if not exists saved_tutors_student_created_idx
  on public.saved_tutors (student_id, created_at desc);

alter table public.saved_tutors enable row level security;

-- Self-only: student_id is the owner column (mirrors "student self rw" on
-- student_profiles in 0001, keyed on the owner column rather than the PK).
drop policy if exists "saved_tutors self rw" on public.saved_tutors;
create policy "saved_tutors self rw"
  on public.saved_tutors for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);
