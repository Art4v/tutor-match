-- 0014_tutor_subjects_order.sql
--
-- Custom subject ordering. The tutor can drag-and-drop their selected subjects
-- in the settings editor to set the order they appear in on their browse card
-- and public profile. Until now `tutor_subjects` was an unordered join table, so
-- the embed came back in whatever order PostgREST happened to return.
--
-- 1. Adds a `position` column (same convention as the other ordered child tables
--    tutor_packages / tutor_experience / tutor_education).
-- 2. Backfills existing links to ALPHABETICAL order by display label — that's the
--    new default for anyone who hasn't customised. The label mirrors
--    subjectLabel() in lib/subjects.js: exam subjects read "HSC Biology", while
--    the TEST / GENERAL groups read bare ("UCAT" / "English").
-- 3. Adds a (tutor_id, position) index for the ordered read.

alter table public.tutor_subjects
  add column if not exists position int not null default 0;

with ranked as (
  select
    ts.tutor_id,
    ts.subject_id,
    row_number() over (
      partition by ts.tutor_id
      order by case
        when s.exam_code in ('TEST', 'GENERAL') then s.name
        else s.exam_code || ' ' || s.name
      end asc
    ) - 1 as pos
  from public.tutor_subjects ts
  join public.subjects s on s.id = ts.subject_id
)
update public.tutor_subjects ts
set position = ranked.pos
from ranked
where ranked.tutor_id = ts.tutor_id
  and ranked.subject_id = ts.subject_id;

create index if not exists tutor_subjects_tutor_position_idx
  on public.tutor_subjects (tutor_id, position);
