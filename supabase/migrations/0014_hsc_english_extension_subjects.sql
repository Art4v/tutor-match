-- 0014_hsc_english_extension_subjects.sql
-- matchtutor — slice 14: add HSC English Extension 1 + Extension 2 to the
-- subject catalog.
--
-- English Extension 1 was already seeded in 0009 (position 28); this migration
-- guarantees it via ON CONFLICT and adds the missing Extension 2 alongside.
-- Idempotent: safe to re-run.

insert into public.subjects (name, slug, exam_code, position) values
  ('English Extension 1', 'hsc-english-extension-1', 'HSC', 28),
  ('English Extension 2', 'hsc-english-extension-2', 'HSC', 31)
on conflict (slug) do nothing;
