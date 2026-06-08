-- ============================================================================
-- tutormatch — slice 21: tutor verification request flow + notifications
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0020 (in order). Builds on the `verified` boolean added in
--   0003 and reuses the SECURITY DEFINER / auth.uid() pattern from
--   0015_delete_own_account and 0020_ai_usage.
--
-- WHY:
--   A tutor can request that their account be verified. The request is emailed
--   to the admin, who approves it from a one-click link (see
--   app/api/verification/*). On approval the existing `verified` flag flips true
--   (which already renders the VerifiedTick everywhere) and the tutor is ranked
--   above unverified tutors (see lib/ranking.js). Both "request sent" and
--   "you're verified" produce a notification the tutor sees on /notifications.
--
-- WHAT THIS DOES:
--   * tutor_profiles.verification_status / .verification_requested_at — the
--     request lifecycle. `verified` (0003) stays the display flag, set true only
--     on approval.
--   * notifications — one row per event the tutor sees on /notifications.
--     Self-only SELECT + UPDATE (mark-as-read). No INSERT policy: rows are
--     written by the service-role client from the API routes (bypasses RLS).
--   * request_tutor_verification() — the tutor-side gate. Flips a none/rejected
--     tutor to 'pending' and stamps the time; idempotent for pending/verified.
--     Approval has no RPC — it runs through the service-role client in the
--     approve route, because the admin has no user session when they click the
--     email link.
-- ============================================================================

-- 1. Verification lifecycle on tutor_profiles -------------------------------
alter table public.tutor_profiles
  add column if not exists verification_status text not null default 'none',
  add column if not exists verification_requested_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tutor_profiles_verification_status_check'
  ) then
    alter table public.tutor_profiles
      add constraint tutor_profiles_verification_status_check
      check (verification_status in ('none', 'pending', 'verified', 'rejected'));
  end if;
end $$;

-- Keep status in step with any rows already flagged verified before this slice.
update public.tutor_profiles
   set verification_status = 'verified'
 where verified = true and verification_status = 'none';

-- 2. notifications ----------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,            -- 'verification_requested' | 'verification_approved'
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Owner can read their own notifications and mark them read. There is
-- deliberately no INSERT policy — notifications are created by the service-role
-- client in the API routes, so a tutor can't forge them.
drop policy if exists "notifications self read" on public.notifications;
create policy "notifications self read"
  on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists "notifications self update" on public.notifications;
create policy "notifications self update"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. request_tutor_verification() -------------------------------------------
-- Tutor-side gate, scoped to auth.uid() (modelled on assign_tutor_slug, 0013).
-- Moves a none/rejected tutor to 'pending' and stamps the request time; returns
-- the resulting status unchanged when already pending/verified (idempotent, so
-- a double-click doesn't re-trigger the admin email in the route).
create or replace function public.request_tutor_verification()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid := auth.uid();
  v_status text;
begin
  if v_id is null then
    raise exception 'not authenticated';
  end if;

  select verification_status into v_status
    from tutor_profiles where id = v_id
    for update;

  if v_status is null then
    raise exception 'no tutor profile for current user';
  end if;

  if v_status in ('none', 'rejected') then
    update tutor_profiles
       set verification_status = 'pending',
           verification_requested_at = now()
     where id = v_id;
    v_status := 'pending';
  end if;

  return v_status;
end;
$$;

revoke all on function public.request_tutor_verification() from public;
grant execute on function public.request_tutor_verification() to authenticated;
