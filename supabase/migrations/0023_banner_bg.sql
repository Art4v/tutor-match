-- 0023_banner_bg.sql
-- Decouples the banner fallback colour from the avatar fallback colour.
-- Previously a single column `avatar_bg` drove both (the colored circle behind
-- a missing avatar AND the banner backdrop when no banner image was uploaded),
-- so picking a "Banner colour" in /settings also recoloured the avatar — which
-- visually merged with the banner and made the pfp look like it had vanished.
--
-- Adds a nullable `banner_bg`. The banner readers fall back to `avatar_bg` when
-- `banner_bg` is null, so existing rows render unchanged. New picks made via
-- the "Banner colour" swatches write `banner_bg` only.

alter table public.tutor_profiles
  add column if not exists banner_bg text;
