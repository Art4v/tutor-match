-- ============================================================================
-- tutormatch — slice 5: default new tutor profiles to 'public'
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON:
--   0001_init.sql, 0002_tutor_profile.sql, 0003_tutor_dashboard.sql,
--   0004_browse.sql.
--
-- WHAT THIS DOES:
--   Reverses step 5 of 0004_browse.sql. New tutor signups now default to
--   'public' visibility, so a profile appears on /browse as soon as the row is
--   created by handle_new_user() — no explicit publish step required.
--
--   Existing rows are left as-is. If you want previously-created 'unlisted'
--   profiles to become public too, uncomment the UPDATE below.
-- ============================================================================

alter table public.tutor_profiles
  alter column visibility set default 'public';

-- Optional backfill: promote existing unlisted profiles to public.
-- update public.tutor_profiles set visibility = 'public' where visibility = 'unlisted';
