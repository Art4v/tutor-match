-- ============================================================================
-- tutormatch — slice 55: RLS hardening (lock down direct writes + public reads)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0054 (in order). Tightens policies first created in 0002
--   (tutor_profiles read), 0004 (profiles tutor read) and 0044 (conversations
--   update), and recreates the geo RPC from 0008.
--
-- WHY:
--   Two data-layer holes the app was papering over in JS:
--
--   1. The "conversations participants update" policy (0044) restricts neither
--      columns nor side, and the default GRANT UPDATE to `authenticated` was never
--      revoked. So a participant could `supabase.from('conversations').update(...)`
--      ANY column straight from the browser: forge the counterpart's read /
--      notified / presence cursors, set last_message_at on an empty conversation
--      (defeating the "first message is the student's" rule), or even reassign
--      student_id/tutor_id to hand the thread to another account. No legitimate
--      write needs this — every cursor/presence/notify write already goes through a
--      SECURITY DEFINER RPC (mark_conversation_read, touch_conversation_presence,
--      claim_message_notification) or the bump trigger, all of which bypass RLS.
--      Fix: drop the policy and revoke UPDATE.
--
--   2. Disabling a tutor (0052) only hid them in the app helpers
--      (lib/supabase/tutors.js). The underlying RLS still served them: tutor_profiles
--      read was `using (true)`, profiles tutor-read was `using (role = 'tutor')`, and
--      tutors_within_service_radius (0008) filtered only visibility + confirmation.
--      So any anon-key client could read a disabled tutor's full profile or get their
--      id from the geo RPC. Fix: fold `status = 'enabled'` into the public-read
--      policies and the geo RPC, making "publicly listable" a DB property. The
--      app-layer `.eq("profile.status","enabled")` filters become defence-in-depth.
--
-- WHAT THIS DOES:
--   * Drops the conversations UPDATE policy + revokes UPDATE from authenticated.
--   * Recreates tutor_profiles public-read (0002) gated on the owner being enabled.
--   * Recreates profiles tutor public-read (0004) gated on status = 'enabled'.
--   * Recreates tutors_within_service_radius (0008) joined to an enabled profile.
-- ============================================================================

-- 1. Close the wide-open conversations UPDATE --------------------------------
-- No client-level UPDATE is needed: read cursors (mark_conversation_read),
-- presence (touch_conversation_presence), notify cursors (claim_message_notification)
-- and last_message_at (the bump trigger) are all SECURITY DEFINER and unaffected.
drop policy if exists "conversations participants update" on public.conversations;
revoke update on public.conversations from authenticated;

-- 2. Hide disabled tutors at the data layer ---------------------------------
-- profiles: a tutor row is publicly readable only while the account is enabled.
-- Self-read (0001) is a separate policy, so the owner still sees their own row.
drop policy if exists "profile tutor public read" on public.profiles;
create policy "profile tutor public read"
  on public.profiles for select
  using (role = 'tutor' and status = 'enabled');

-- tutor_profiles: readable only when the owning profile is enabled. tutor_profiles
-- has no status column of its own, so key off profiles via a correlated subquery
-- (evaluated under the caller's RLS — for a disabled tutor the profiles row is now
-- unreadable anyway, so the two policies agree). Self-read (0001) still applies to
-- the owner.
drop policy if exists "tutor_profiles public read" on public.tutor_profiles;
create policy "tutor_profiles public read"
  on public.tutor_profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = tutor_profiles.id
        and p.status = 'enabled'
    )
  );

-- 3. Geo RPC: exclude disabled tutors ---------------------------------------
-- Recreate 0008's haversine helper, joined to profiles with status = 'enabled' so
-- a disabled tutor's id can never come back from a location search.
create or replace function public.tutors_within_service_radius(
  p_lat            double precision,
  p_lng            double precision,
  p_include_online boolean default true
)
returns table (tutor_id uuid)
language sql
stable
as $$
  select tp.id
  from public.tutor_profiles tp
  join public.profiles p on p.id = tp.id
  where tp.visibility = 'public'
    and tp.email_confirmed_at is not null
    and p.status = 'enabled'
    and (
      (p_include_online and tp.delivers_online)
      or (
        tp.delivers_in_person
        and tp.service_lat is not null
        and tp.service_lng is not null
        and 6371 * 2 * asin(sqrt(
              power(sin(radians(tp.service_lat - p_lat) / 2), 2)
            + cos(radians(p_lat)) * cos(radians(tp.service_lat))
            * power(sin(radians(tp.service_lng - p_lng) / 2), 2)
        )) <= coalesce(tp.service_radius_km, 5)
      )
    );
$$;

grant execute on function public.tutors_within_service_radius(double precision, double precision, boolean)
  to anon, authenticated;
