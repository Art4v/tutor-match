-- ============================================================================
-- tutormatch — slice 3: tutor dashboard fields
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON:
--   0002_tutor_profile.sql must already be applied.
--
-- WHAT THIS DOES:
--   - Renames `atar_rank` -> `rank` (the dashboard splits this into rank +
--     rank_subject; the old single-string column was unused).
--   - Adds the columns the tutor dashboard editor saves into:
--       headline, rank_subject, verified, delivers_in_person, delivers_online,
--       service_area (jsonb), verifications (jsonb), visibility.
--   - Converts `credentials text[]` -> `credentials jsonb` so each credential
--     can carry both a label and an icon name (trophy / graduation / etc.).
--   - Existing RLS policies (tutor self-write, public read) from 0002 already
--     cover the new columns — no policy changes needed.
-- ============================================================================

-- 1. Scalar columns ----------------------------------------------------------

alter table public.tutor_profiles rename column atar_rank to rank;

alter table public.tutor_profiles
  add column headline             text,
  add column rank_subject         text,
  add column verified             bool not null default false,
  add column delivers_in_person   bool not null default true,
  add column delivers_online      bool not null default true,
  add column service_area         jsonb,
  add column verifications        jsonb not null default '[]'::jsonb,
  add column visibility           text  not null default 'public';

alter table public.tutor_profiles
  add constraint tutor_profiles_visibility_check
  check (visibility in ('public', 'unlisted', 'hidden'));

-- 2. credentials: text[] -> jsonb of {label, icon} --------------------------
-- Postgres forbids subqueries inside `alter column ... type ... using ...`
-- transform expressions, so we can't `unnest()` the old text[] into jsonb
-- in a single statement. Because no real tutor data exists yet (the only
-- column writers are the dashboard editor that this slice introduces),
-- the safe, simple fix is to drop the old column and re-create it as
-- jsonb with the desired default. If you ever need to migrate this with
-- live data, do it via a temporary helper function (or a USING clause that
-- calls one), not an inline subquery.

alter table public.tutor_profiles drop column credentials;

alter table public.tutor_profiles
  add column credentials jsonb not null default '[]'::jsonb;
