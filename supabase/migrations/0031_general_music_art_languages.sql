-- 0031_general_music_art_languages.sql
-- matchtutor — slice 31: add Art, Music and Languages to the GENERAL subject
-- group, as three separate subjects.
--
-- Appended after the existing GENERAL range (0011 seeded positions 1–5),
-- so these take positions 6–8. Idempotent: safe to re-run (the upsert also
-- corrects positions if an earlier ordering of this migration was applied).

insert into public.subjects (name, slug, exam_code, position) values
  ('Art',       'general-art',       'GENERAL', 6),
  ('Music',     'general-music',     'GENERAL', 7),
  ('Languages', 'general-languages', 'GENERAL', 8)
on conflict (slug) do update set position = excluded.position;
