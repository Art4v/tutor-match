-- ============================================================================
-- tutormatch — slice 18: first-login onboarding flag
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0017 (in order).
--
-- WHY:
--   New tutors should be greeted by the /onboarding questionnaire the first
--   time they reach /settings, then never see it again. We need a durable
--   per-tutor flag rather than a fragile "is the profile empty?" heuristic.
--
-- WHAT THIS DOES:
--   1. Adds tutor_profiles.onboarded (boolean, NOT NULL, default false). The
--      default means every new handle_new_user() insert is un-onboarded
--      automatically — no trigger change needed.
--   2. Backfills all existing tutors to true so current users (who already have
--      profiles) are not sent through onboarding.
-- ============================================================================

alter table public.tutor_profiles
  add column onboarded boolean not null default false;

update public.tutor_profiles set onboarded = true;
