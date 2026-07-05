-- ============================================================================
-- tutormatch — slice 38: drop dead tutor_packages columns
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0037 (in order).
--
-- WHY:
--   `duration` and `save_text` on tutor_packages are dead. They are:
--     - NEVER written — the save_tutor_profile RPC (0029/0036) inserts only
--       (tutor_id, label, price, position); saveTutorProfile's payload carries
--       only { label, price }. Every existing row has them NULL.
--     - NEVER rendered — RateCard.jsx and the editor RateSection read only
--       `label` / `price`; both read mappers in lib/supabase/tutors.js project
--       only { label, price }. They were merely SELECTed and dropped on the floor.
--
--   The two detail SELECTs that named these columns are removed in the same
--   change (lib/supabase/tutors.js), so drop the columns and deploy the code
--   TOGETHER — a live query naming a dropped column errors.
--
-- WHAT THIS DOES:
--   Drops the two columns. No RPC change needed — its INSERT never listed them.
-- ============================================================================

alter table public.tutor_packages
  drop column if exists duration,
  drop column if exists save_text;
