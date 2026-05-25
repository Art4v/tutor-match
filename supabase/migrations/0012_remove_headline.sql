-- 0012_remove_headline.sql
-- Removes the tutor "headline" field. It overlapped almost entirely with the
-- "tagline" (tutor_profiles.bio): both were one-line descriptors shown under the
-- tutor's name. The tagline now takes over that role everywhere (profile header,
-- browse-card subtitle, and the field the /browse `q` search matches).
--
-- No content is lost: any headline text is migrated into the tagline first, but
-- only where the tagline is currently empty (an existing tagline wins).

update public.tutor_profiles
   set bio = headline
 where (bio is null or btrim(bio) = '')
   and headline is not null
   and btrim(headline) <> '';

alter table public.tutor_profiles drop column headline;
