-- 0011_year_levels_and_general.sql
-- Two related additions for K–12 tutoring:
--   1. tutor_profiles.year_min / year_max — the year-level range a tutor will
--      teach (Kindergarten = 0 … Year 12 = 12). Drives the /browse year filter
--      and the public profile card. Defaults to Years 7–12 so the existing
--      senior-secondary tutor base stays visible until they widen the range.
--   2. A new 'GENERAL' exam group (English, Mathematics, Science, History,
--      Geography) for pre-Year-11 / foundation tutoring. Behaves like any other
--      exam group — selectable in settings, filterable on /browse. Labelled
--      "bare" (no exam prefix) like the TEST group; see lib/subjects.js.

-- 1. year-level range on tutor_profiles --------------------------------------

alter table public.tutor_profiles
  add column if not exists year_min int not null default 7,
  add column if not exists year_max int not null default 12;

-- Backfill is implicit (the NOT NULL defaults populate existing rows at 7/12),
-- but state it explicitly for any rows that predate the defaults.
update public.tutor_profiles
  set year_min = coalesce(year_min, 7),
      year_max = coalesce(year_max, 12);

alter table public.tutor_profiles
  add constraint tutor_profiles_year_range_chk
  check (
    year_min between 0 and 12
    and year_max between 0 and 12
    and year_min <= year_max
  );

-- 2. 'GENERAL' exam group + foundation subjects ------------------------------

-- Surfaced first in the subject picker (position 0) as the starting point for
-- younger students. jurisdiction / external_exams are null, matching TEST.
insert into public.exams (code, name, jurisdiction, external_exams, position) values
  ('GENERAL', 'General (Primary & Junior Secondary)', null, null, 0)
on conflict (code) do nothing;

insert into public.subjects (name, slug, exam_code, position) values
  ('English',     'general-english',     'GENERAL', 1),
  ('Mathematics', 'general-mathematics', 'GENERAL', 2),
  ('Science',     'general-science',     'GENERAL', 3),
  ('History',     'general-history',     'GENERAL', 4),
  ('Geography',   'general-geography',   'GENERAL', 5)
on conflict (slug) do nothing;
