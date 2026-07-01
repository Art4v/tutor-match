-- 0030_hsc_language_subjects.sql
-- matchtutor — slice 30: add Japanese, French and Italian to the HSC subject
-- catalog.
--
-- Appended after the existing HSC range (0009 seeded 1–30, 0024 added 31),
-- so these take positions 32–34. Idempotent: safe to re-run.

insert into public.subjects (name, slug, exam_code, position) values
  ('Japanese', 'hsc-japanese', 'HSC', 32),
  ('French', 'hsc-french', 'HSC', 33),
  ('Italian', 'hsc-italian', 'HSC', 34)
on conflict (slug) do nothing;
