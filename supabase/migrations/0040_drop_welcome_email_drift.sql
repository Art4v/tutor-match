-- ============================================================================
-- tutormatch — slice 40: drop drifted welcome_email_sent_at column
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0039 (in order).
--
-- WHY:
--   Production's tutor_profiles carries a welcome_email_sent_at column that no
--   migration ever created — schema drift from an ad-hoc ALTER run in the SQL
--   editor while prototyping the welcome email. That design was abandoned:
--   sendWelcomeIfNeeded (lib/notifications.js) went idempotent via the
--   `type='welcome'` notifications row instead, so the column was never read
--   or written by shipped code. The drift surfaced when a pg_dump of prod
--   failed to restore into a migrations-built database (unknown column).
--
-- WHAT THIS DOES:
--   Drops the column. `if exists` makes it correct everywhere: prod (drops the
--   drift), any database patched by hand to accept a prod dump (drops the
--   patch), and databases built purely from migrations (no-op).
-- ============================================================================

alter table public.tutor_profiles
  drop column if exists welcome_email_sent_at;
