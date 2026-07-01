-- ============================================================================
-- tutormatch — slice 28: verification single source of truth
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0021 (verification_status) and 0027.
--
-- WHY:
--   `verified` (bool) and `verification_status` (enum) were maintained in
--   lockstep — the approve/reject routes wrote both together. That's a redundant
--   pair that can silently drift. `verification_status` is the richer value (it
--   also encodes 'none'/'pending'/'rejected'), so it becomes the ONLY stored
--   truth. The app now derives the boolean in its read mappers as
--   `verification_status = 'verified'` (see lib/supabase/tutors.js), so all
--   display + ranking code is unchanged.
--
-- WHAT THIS DOES:
--   1. Reconciles any legacy divergence so no verified state is lost when the
--      bool is dropped (belt-and-braces — 0021 already backfilled status).
--   2. Drops the `verified` column.
--
-- ORDERING NOTE: apply this migration BEFORE deploying the matching code (which
--   stops selecting `verified`). Old code reading a now-missing column would 500;
--   new code reading a still-present column is harmless — so DB-first is safe.
-- ============================================================================

-- 1. Reconcile before drop (no-op if 0021's backfill already aligned everything).
update public.tutor_profiles
   set verification_status = 'verified'
 where verified = true and verification_status is distinct from 'verified';

update public.tutor_profiles
   set verification_status = 'none'
 where verified = false and verification_status = 'verified';

-- 2. Drop the redundant display flag.
alter table public.tutor_profiles drop column if exists verified;
