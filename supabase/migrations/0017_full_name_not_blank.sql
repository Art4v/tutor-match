-- ============================================================================
-- tutormatch — slice 17: profiles.full_name must not be blank
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0016 (in order).
--
-- WHY:
--   A whitespace-only full name produced an empty heading on /tutor/<slug> and
--   a 'tutor' fallback slug. The /settings UI and saveTutorProfile() now reject
--   blank names; this is the DB backstop so nothing can write one directly.
--
-- WHAT THIS DOES:
--   1. Normalizes any existing blank names to NULL so the constraint can be
--      added without violating existing rows.
--   2. Adds a CHECK that full_name is either NULL or non-blank after trimming.
--      NULL stays allowed so OAuth signups with no name claim (handle_new_user
--      may insert NULL) aren't blocked.
-- ============================================================================

update public.profiles set full_name = null
  where full_name is not null and btrim(full_name) = '';

alter table public.profiles
  add constraint profiles_full_name_not_blank
  check (full_name is null or btrim(full_name) <> '');
