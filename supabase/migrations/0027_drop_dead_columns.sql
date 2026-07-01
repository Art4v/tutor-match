-- ============================================================================
-- tutormatch — slice 27: drop dead tutor_profiles columns
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0026 (in order).
--
-- WHY:
--   Three columns on tutor_profiles are dead weight — read/written nowhere in the
--   app (confirmed by a full-codebase audit). Removing them shrinks the table and
--   removes traps for the next reader:
--     * online           — superseded by delivers_in_person / delivers_online (0003).
--     * location_display  — legacy "Lower North Shore + Online" string; never read.
--     * verifications     — jsonb that only ever held the default '[]' (the app
--                           passes an empty array through; nothing displays it). The
--                           real verification state lives in verified /
--                           verification_status (0021).
--
-- WHAT THIS DOES:
--   Drops the three columns. No backfill: none of them carry data of value (the
--   app never populated them with anything meaningful). `if exists` keeps this
--   idempotent / safe to re-run.
-- ============================================================================

alter table public.tutor_profiles
  drop column if exists online,
  drop column if exists location_display,
  drop column if exists verifications;
