-- ============================================================================
-- tutormatch — slice 16: profiles.full_name must not be blank
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001 (creates public.profiles).
--
-- WHY:
--   The settings editor (saveTutorProfile in lib/supabase/tutors.js) writes
--   profiles.full_name directly with the browser Supabase client — there is no
--   server route in between. The editor + data layer now reject a blank name,
--   but this CHECK is the authoritative server-side guarantee: the database
--   refuses to persist an empty / whitespace-only name no matter which client
--   issues the write.
--
-- WHAT THIS DOES:
--   1. Normalises any existing blank/whitespace full_name to NULL so the
--      constraint can be added cleanly on live data.
--   2. Adds a CHECK that allows NULL but forbids a blank string. NULL stays
--      allowed because handle_new_user() may insert it for an OAuth signup whose
--      provider sent no name (see 0015) — that path must not be blocked; only a
--      saved *blank string* (what the editor would produce) is rejected.
--
--   Safe to run on a live DB: one UPDATE of already-blank rows + one ALTER.
-- ============================================================================

update public.profiles
  set full_name = null
  where full_name is not null and btrim(full_name) = '';

alter table public.profiles
  add constraint profiles_full_name_not_blank
  check (full_name is null or btrim(full_name) <> '');
