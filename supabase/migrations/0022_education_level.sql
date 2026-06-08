-- ============================================================================
-- tutormatch — slice 22: high-school vs university on tutor education
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0021 (in order). Extends tutor_education from 0002.
--
-- WHY:
--   Education entries (0002) only stored school + detail, with no way to tell a
--   high school apart from a university. The tutor card now wants to surface one
--   of each (high school stacked above university), and the public profile labels
--   each entry — both need a typed level on the row.
--
-- WHAT THIS DOES:
--   Adds tutor_education.level (text, NOT NULL, default 'high_school', CHECK in
--   {'high_school','university'}). A NOT NULL column with a default backfills
--   every existing row to 'high_school', so all current education defaults to
--   high school with no separate backfill. handle_new_user() never inserts
--   education rows, so no trigger change is needed.
-- ============================================================================

alter table public.tutor_education
  add column level text not null default 'high_school'
    check (level in ('high_school', 'university'));
