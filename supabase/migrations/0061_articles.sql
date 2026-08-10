-- ============================================================================
-- tutormatch — slice 61: articles (the blog, moved out of the repo)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Studio -> SQL Editor -> paste the contents of this file -> Run.
--
-- DEPENDS ON: 0001..0060 (in order). profiles/tutor_profiles from 0001-0002,
--   tutor_profiles.slug from 0004, avatar_url from 0006, profiles.status from
--   0052, the narrowed public read policies from 0055.
--
-- WHY:
--   The blog shipped as five JSX modules under content/blog/ with a manifest,
--   read through lib/blog.js. CLAUDE.md called that a deliberate seam: every
--   read was already async and shaped like a Supabase helper so the store could
--   move without touching a page. This is that move, plus the authoring
--   capability that makes the blog writable by designated people.
--
--   Three things change beyond a straight port:
--     - The BODY becomes MARKDOWN (body_md), parsed per request into the node
--       tree app/blog/[slug]/ArticleBody.jsx renders. NOT html, and nothing is
--       ever handed to dangerouslySetInnerHTML — the repo still has zero of
--       those. The parser runs markdown-it with html:false and maps its tokens
--       onto a fixed node union, so an unrecognised construct is DROPPED rather
--       than passed through. That whitelist is the security boundary, and it is
--       why authors can be trusted with a text field.
--     - The AUTHOR becomes a real tutor instead of a name copied into metadata.
--     - The per-article gradient becomes a real cover photo in a new bucket.
--
-- WHAT THIS DOES:
--   1. profiles.can_author_articles — the authoring capability, plus a guard
--      trigger that stops a user granting it to themselves. This is NOT
--      optional: "profile self update" (0001) is `for update using (auth.uid()
--      = id)` with no WITH CHECK and no column restriction, so without the
--      trigger anyone could run
--        supabase.from('profiles').update({ can_author_articles: true })
--      from the browser and start publishing. Same hole 0057 closed on
--      tutor_profiles.rating, same fix.
--   2. articles — one row per article. status draft -> published, with pending
--      and removed available. RLS keeps writes scoped to the author AND to the
--      capability, so an ordinary tutor cannot write to the blog at all.
--   3. blog-images — public Storage bucket for cover art. Modelled on
--      profile-images (0006), not tutor-docs (0034): cover art is a replaceable
--      image, so it gets an UPDATE policy and upsert is allowed.
--   4. An updated_at touch trigger.
--   5. A backfill granting the capability to the two seeded authors.
--
--   NO SECURITY DEFINER read function, deliberately. get_tutor_reviews() exists
--   because 0055 narrowed the public profiles read to tutor rows and
--   student_profiles is self-only, so a public page cannot join a STUDENT's
--   name. Article authors are tutors by construction (see the FK below), so a
--   plain PostgREST select with embeds works for anonymous readers. If authors
--   ever stop being tutors, a definer function is the fix.
--
--   'pending' is in the status CHECK but nothing sets it today, because a
--   designated author publishes their own work. It is kept so that adding an
--   editorial review step later is a route plus a UI, not a schema change: the
--   signed-link pattern (lib/reviewToken.js -> /api/reviews/approve ->
--   /admin/review) drops straight on top.
-- ============================================================================

-- 1. Authoring capability ----------------------------------------------------
alter table public.profiles
  add column if not exists can_author_articles boolean not null default false;

-- Granting is out of band only: supabase/utilities/grant_author.sql, run as
-- service_role in the SQL editor. There is no client path, by design.
--
-- WHY A TRIGGER AND NOT A REVOKE: identical reasoning to 0057's guard on
-- tutor_profiles.rating. Per the Postgres REVOKE docs, "if a role has been
-- granted privileges on a table, then revoking the same privileges from
-- individual columns will have no effect" — effective column privilege is the
-- UNION of the table-wide and column-specific grants. Making a column REVOKE
-- bite would mean revoking table-level UPDATE on profiles and re-granting every
-- other column one by one, which then silently breaks the next `alter table ...
-- add column` until someone remembers the matching grant. Revoking UPDATE
-- outright is not available either: profiles has legitimate direct client
-- writes (the name edit in saveTutorProfile).
--
-- It PINS rather than RAISES so a client that echoes back a whole profile row
-- can't start failing on a column it never meant to touch. Inside
-- accept_current_terms() and choose_role() (both SECURITY DEFINER) current_user
-- is the function owner rather than 'authenticated', and service_role passes
-- too, which is what lets the grant script work.
create or replace function public.profiles_guard_capabilities()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.can_author_articles := old.can_author_articles;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_capabilities on public.profiles;
create trigger profiles_guard_capabilities
  before update on public.profiles
  for each row execute function public.profiles_guard_capabilities();

-- 2. Table -------------------------------------------------------------------
create table if not exists public.articles (
  id            uuid primary key default gen_random_uuid(),

  slug          text not null unique
                  constraint articles_slug_not_blank check (btrim(slug) <> ''),
  title         text not null
                  constraint articles_title_not_blank check (btrim(title) <> ''),
  -- Optional but never blank-but-present, like reviews.body (0057) and
  -- profiles.full_name (0017), so no surface has to render an empty string.
  excerpt       text
                  constraint articles_excerpt_not_blank
                  check (excerpt is null or btrim(excerpt) <> ''),
  -- Free text rather than a CHECK list: the page already renders it
  -- conditionally, and pinning the vocabulary would make "add a category" a
  -- migration. The authoring UI is where the list gets constrained.
  category      text
                  constraint articles_category_not_blank
                  check (category is null or btrim(category) <> ''),

  -- The article, as Markdown. Sections come from `##` headings at parse time,
  -- which is what produces the table of contents and the anchor ids, so the
  -- section structure is derived from the copy rather than stored beside it.
  -- lib/markdown.js is the only thing that reads this column's contents.
  body_md       text
                  constraint articles_body_md_not_blank
                  check (body_md is null or btrim(body_md) <> ''),

  status        text not null default 'draft'
                  check (status in ('draft', 'pending', 'published', 'removed')),

  -- FK to tutor_profiles, NOT profiles: combined with can_author_articles this
  -- makes "an author is a DESIGNATED TUTOR" hold from two directions, and a
  -- flagged non-tutor simply fails the FK rather than half-working.
  -- set null, not cascade: deleting the account should cost the site its byline,
  -- not its article, for the same reason 0059 refused to cascade review_id.
  author_id     uuid references public.tutor_profiles(id) on delete set null,

  -- A storage PATH inside blog-images, never a full URL: baking the project ref
  -- into the data means a dump restored into another project has broken images.
  cover_path    text
                  constraint articles_cover_path_not_blank
                  check (cover_path is null or btrim(cover_path) <> ''),
  cover_alt     text
                  constraint articles_cover_alt_not_blank
                  check (cover_alt is null or btrim(cover_alt) <> ''),
  -- Mirrors tutor_documents (0034): a row can only point at a path its own
  -- author could have written under the bucket's owner-folder policy below.
  -- Passes when either side is NULL, which is what keeps ON DELETE SET NULL
  -- from failing this check on an article that still has cover art.
  constraint articles_cover_in_author_folder
    check (cover_path is null or author_id is null
           or split_part(cover_path, '/', 1) = author_id::text),

  -- DATE, not timestamptz, for both reader-visible dates. PostgREST returns a
  -- date as "2026-02-10", the same ISO string lib/blog.js already sorts and
  -- formats, and a date cannot render as the following day in Sydney the way a
  -- late-evening UTC timestamp would.
  published_at        date,
  -- The reader-visible "Updated 5 Jun 2026" line. Deliberately NOT updated_at:
  -- if they were one column, the touch trigger below would bump the date shown
  -- to readers every time an author re-saved a typo fix.
  content_updated_at  date,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- The /blog index: published only, newest first.
create index if not exists articles_status_published_idx
  on public.articles (status, published_at desc);

-- "everything by this author" — the /author dashboard, and working out the
-- blast radius when an account is disabled.
create index if not exists articles_author_idx
  on public.articles (author_id);

-- getRelatedArticles partitions on category before slicing.
create index if not exists articles_category_idx
  on public.articles (category);

alter table public.articles enable row level security;

-- 3. RLS ---------------------------------------------------------------------
-- Published articles are public content.
drop policy if exists "articles public read" on public.articles;
create policy "articles public read"
  on public.articles for select
  using (status = 'published');

-- The author sees their own row in ANY state, which is the only way a draft is
-- visible to the person writing it.
drop policy if exists "articles self read" on public.articles;
create policy "articles self read"
  on public.articles for select
  using (author_id = auth.uid());

-- Both write policies require the CAPABILITY, not just ownership. Without the
-- exists(...) clause any tutor could insert an article naming themselves as the
-- author, which combined with self-publish would mean an open blog.
--
-- 'published' is permitted here because a designated author publishes their own
-- work — that is the deliberate difference from 0057's reviews ladder, where a
-- student is structurally barred from approving themselves. The trust boundary
-- is the capability flag and the guard trigger in section 1, not the status.
drop policy if exists "articles self insert" on public.articles;
create policy "articles self insert"
  on public.articles for insert
  with check (
    author_id = auth.uid()
    and status in ('draft', 'pending', 'published')
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.can_author_articles
    )
  );

drop policy if exists "articles self update" on public.articles;
create policy "articles self update"
  on public.articles for update
  using (author_id = auth.uid() and status <> 'removed')
  with check (
    author_id = auth.uid()
    and status in ('draft', 'pending', 'published')
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.can_author_articles
    )
  );

-- 'removed' is terminal: an author cannot delete an article that was taken
-- down, so the record of what was published survives the takedown. Revoking
-- can_author_articles also freezes every article that author owns, since both
-- write policies fail the exists(...) from then on.
drop policy if exists "articles self delete" on public.articles;
create policy "articles self delete"
  on public.articles for delete
  using (author_id = auth.uid() and status <> 'removed');

-- 4. Cover art bucket --------------------------------------------------------
-- Public like profile-images (0006). 5 MB and image-only are enforced by the
-- bucket itself, so a client that skips its own validation still cannot get a
-- 40 MB PNG in. Mirrored in JS by MAX_IMAGE_BYTES in lib/supabase/storage.js.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 5242880, array['image/*'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "blog-images public read" on storage.objects;
create policy "blog-images public read"
  on storage.objects for select
  using (bucket_id = 'blog-images');

-- Writes are scoped to <uid>/ so an author can only touch their own folder,
-- which is the same key articles_cover_in_author_folder checks above.
drop policy if exists "blog-images owner insert" on storage.objects;
create policy "blog-images owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'blog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Unlike tutor-docs, cover art is replaceable, so UPDATE exists and uploads may
-- use upsert (the profile-images model, 0006).
drop policy if exists "blog-images owner update" on storage.objects;
create policy "blog-images owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'blog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'blog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "blog-images owner delete" on storage.objects;
create policy "blog-images owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'blog-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- NOTE: the public read policy above is also what makes owner deletes work.
-- 0035 was a whole migration to fix exactly this: the Storage API's remove()
-- checks SELECT as well as DELETE, so a bucket whose only SELECT policy is
-- owner-scoped (or absent) silently no-ops deletes and orphans the file. Here
-- SELECT is public, so every owner is already covered. Do not narrow it without
-- adding an owner SELECT policy in the same change.

-- 5. updated_at --------------------------------------------------------------
-- Maintained here so no route has to remember to pass it. Note this touches
-- updated_at only; content_updated_at is authored copy and is never set here.
create or replace function public.articles_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists articles_touch_updated_at on public.articles;
create trigger articles_touch_updated_at
  before update on public.articles
  for each row execute function public.articles_touch_updated_at();

-- 6. Grant the capability to the seeded authors ------------------------------
-- The five articles in scripts/blog-seed/ are bylined to these two tutors, so
-- without this the seed data would be owned by people who can no longer edit
-- it. A no-op on a fresh database where those slugs don't exist, which keeps
-- the migration safe to re-run anywhere.
update public.profiles
   set can_author_articles = true
 where id in (
   select id from public.tutor_profiles
    where slug in ('aarav-bhatt', 'eric-chen')
 );
