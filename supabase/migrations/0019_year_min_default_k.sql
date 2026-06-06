-- ============================================================================
-- tutormatch — slice 19: default new tutors to K–12 year range
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0018 (in order). Adjusts the default set in 0011.
--
-- WHY:
--   New tutors should advertise the widest sensible range by default so they're
--   discoverable while they fill out their profile. 0011 defaulted year_min to
--   7 (→ Years 7–12); we want K–12 instead.
--
-- WHAT THIS DOES:
--   Lowers the year_min column default from 7 to 0 (Kindergarten). year_max
--   already defaults to 12, so new signups now land at K–12. Only NEW inserts
--   are affected — handle_new_user() inserts a tutor row without specifying
--   year_min, so the new default applies. Existing rows are left untouched
--   (no backfill). The 0011 CHECK (year_min between 0 and 12, year_min <=
--   year_max) already permits 0.
-- ============================================================================

alter table public.tutor_profiles
  alter column year_min set default 0;
