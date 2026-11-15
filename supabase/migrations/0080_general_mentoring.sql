-- 0080_general_mentoring.sql
-- matchtutor — slice 80: add Mentoring to the GENERAL subject group.
--
-- Appended after the existing GENERAL range (0011 seeded positions 1–5,
-- 0031 added 6–8), so it takes position 9. Not an umbrella: no exam-scoped
-- subject belongs to its family, so lib/subjectFamilies.js is unchanged.
-- Idempotent: safe to re-run (the upsert also corrects the position).

insert into public.subjects (name, slug, exam_code, position) values
  ('Mentoring', 'general-mentoring', 'GENERAL', 9)
on conflict (slug) do update set position = excluded.position;
