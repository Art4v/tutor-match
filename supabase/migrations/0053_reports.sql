-- ============================================================================
-- tutormatch — slice 53: user reports ("report and block")
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0052 (in order). References conversations (0044) and the
--   profiles.status column (0052).
--
-- WHY:
--   A user in a conversation can "report and block" the other party. The block
--   is a plain self-RLS write (0049); the REPORT is a service-role-written row
--   here that routes the incident to the admin. The admin reviews the full
--   conversation on /admin/report (authorized by a signed token, no login) and
--   resolves it by disabling the reported OR reporter account, or dismissing.
--
-- WHAT THIS DOES:
--   * reports — one row per filed report. status pending -> resolved; resolution
--     records the outcome. A PARTIAL UNIQUE INDEX enforces "one OPEN report per
--     (reporter, reported) pair" so re-filing while a prior report is still
--     pending is a silent no-op (no admin-email spam).
--   * RLS models notifications (0021): the reporter may SELECT their own rows;
--     there is deliberately NO client INSERT/UPDATE policy — rows are written by
--     the service-role client from the report routes, which bypasses RLS.
-- ============================================================================

-- 1. Table ------------------------------------------------------------------
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references auth.users(id) on delete cascade,
  reported_id     uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  category        text not null check (category in ('harassment', 'spam', 'inappropriate', 'scam', 'other')),
  details         text,
  status          text not null default 'pending' check (status in ('pending', 'resolved')),
  resolution      text check (resolution in ('disabled_reported', 'disabled_reporter', 'dismissed')),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

-- One OPEN (pending) report per direction. A resolved report doesn't block a
-- future one; a still-pending one makes re-filing a no-op (ON CONFLICT).
create unique index if not exists reports_one_open_per_pair
  on public.reports (reporter_id, reported_id) where status = 'pending';

-- Admin review reads by conversation; index the FK.
create index if not exists reports_conversation_idx
  on public.reports (conversation_id);

alter table public.reports enable row level security;

-- 2. RLS: reporter self-read only -------------------------------------------
-- The reporter may read the reports they filed. No INSERT/UPDATE/DELETE policy:
-- writes come from the service-role client in the report routes (like the
-- notifications table). The reported party can never see reports about them.
drop policy if exists "reports reporter read" on public.reports;
create policy "reports reporter read"
  on public.reports for select
  using (reporter_id = auth.uid());
