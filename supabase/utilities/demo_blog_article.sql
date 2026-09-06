-- ============================================================================
-- tutormatch — DEMO BLOG ARTICLE (internal walkthrough, saved as a DRAFT)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   1. Put the author's tutor_profiles.slug in the set_config(...) line below
--      (one spot). It must be a tutor who already holds can_author_articles —
--      grant it with supabase/utilities/grant_author.sql first if not.
--   2. Supabase Studio -> SQL Editor -> paste this whole file -> Run.
--   3. Open /author, click "A tour of the blog editor", and read it in Preview.
--
-- WHAT IT DOES:
--   Inserts (or re-inserts) one article whose body exercises every construct
--   lib/markdown.js understands: sections, sub-headings, lists, links, callouts
--   in all three forms, a table with a caption, the image rules, and the things
--   the parser deliberately refuses. It is written to be READ by a coworker who
--   has never opened /author, so the copy explains the feature it is
--   demonstrating while demonstrating it.
--
--   status = 'draft', deliberately. The article is saved and fully editable but
--   invisible to the public: getArticleBySlug (lib/blog.js) filters on
--   status = 'published', so /blog/demo-blog-editor-tour 404s until someone
--   hits Publish in the editor. That is the point — it is an internal demo, not
--   site content.
--
--   published_at / content_updated_at stay NULL. The editor stamps published_at
--   on the first publish (setArticleStatus), and stamping it here would make a
--   never-published article claim a publish date.
--
--   cover_path stays NULL too: a cover is a Storage object, SQL cannot upload
--   one, and articles_cover_in_author_folder pins the path to the author's own
--   uuid folder anyway. Add one from the editor's Cover image button if you
--   want the card art in the demo.
--
--   Re-running is safe: `on conflict (slug)` overwrites the row from this file
--   and resets it to draft, so any edits made in the editor are LOST. That is
--   the same bargain as scripts/blog-seed — this file is the source, the row is
--   a copy.
--
--   Requires migration 0061.
--
-- TO REMOVE IT AFTERWARDS:
--   delete from public.articles where slug = 'demo-blog-editor-tour';
-- ============================================================================

begin;

-- >>> EDIT THIS LINE — the tutor_profiles.slug the demo is filed under <<<
select set_config('util.author_slug', 'aarav-bhatt', false);

-- Fail loudly rather than inserting nothing. The insert below is an
-- INSERT ... SELECT, so an unknown slug would otherwise write zero rows and
-- report success, which is the least useful outcome available.
do $guard$
begin
  if not exists (
    select 1 from public.tutor_profiles where slug = current_setting('util.author_slug')
  ) then
    raise exception
      'No tutor_profiles row with slug "%". Fix the set_config line at the top of this file.',
      current_setting('util.author_slug');
  end if;
end
$guard$;

insert into public.articles (
  slug, title, excerpt, category, body_md, status, author_id
)
select
  'demo-blog-editor-tour',
  'A tour of the blog editor',
  'Everything the new blog can render, demonstrated on itself: sections, callouts, tables, images, and the constructs the parser refuses. Saved as a draft, so it lives in the editor only.',
  'Behind the scenes',
  $md$
The MatchTutor blog now lives in the database, and this article is a working tour of it. Everything below was typed as plain Markdown in the editor at `/author` and rendered by the same code that renders every published article. If you can see it on the page, you can type it.

This opening paragraph sits above the first heading, which is its own small demo: anything before the first `##` becomes a leading section with no heading of its own, and the contents rail on the right skips it.

## Text, links and emphasis

Body copy is ordinary Markdown. **Bold** renders at weight 500, because the brand has no bold weight anywhere, and *italic* is ordinary emphasis. `Inline code` keeps its words and loses its styling, which is deliberate: dropping it would silently delete part of a sentence.

Links come in three shapes, and every one of them is checked before it renders:

- A site link like [browse tutors](/browse), or an anchor like [jump to publishing](#publishing).
- An external link like [the NESA site](https://educationstandards.nsw.edu.au).
- A mailto link like [email the team](mailto:hello@matchtutor.com.au).

Anything else is refused, and the words survive as plain text rather than vanishing. Autolinking is off on purpose, so a bare address like https://example.com stays a bare address instead of turning itself into a link in the middle of a sentence.

## Lists and sub-headings

### Bullet lists

- One item per line, starting with a dash.
- Items carry **bold**, *italic* and [links](/browse) like any other line.
- Keep them flat. Nested lists are not part of the node set.

### Numbered lists

1. Numbered lists work the same way.
2. The numbers you type are ignored, so a list that goes 1, 1, 1 still renders in order.
3. Reach for them when the order matters, and bullets when it does not.

A `###` sub-heading like the two above stays inside its section: it does not start a new one and it does not appear in the contents rail. Only `##` does that.

## Callouts

A callout is a fenced block, and whatever you write after the marker becomes its title.

:::callout The one rule worth remembering
An unrecognised construct renders nothing at all. That is the security model rather than a bug: the parser knows six kinds of block and drops everything else, which is what makes it safe to hand an author a plain text field.
:::

Leave the title off and you get an untitled one:

:::callout
Callouts hold paragraphs and lists, so they work for a definition, a warning, or an aside that would otherwise break the flow of a section.
:::

A blockquote lands in the same place, because most people reach for one before they read any of this:

> Quoting with a greater-than sign gives you an untitled callout.

## Tables

| What you type | What you get | Notes |
| --- | --- | --- |
| `##` | A new section | Also a contents entry and an anchor |
| `###` | A sub-heading | Stays inside the current section |
| `:::callout` | A callout | Title optional |
| `![alt](path)` | A figure | Inserted by the toolbar, not typed |

*A caption is a fully italic paragraph placed directly after a table or an image. Nothing else is treated as one, so an emphasised sentence elsewhere in the prose is safe.*

Wide tables scroll sideways on a phone instead of squashing, so there is no need to trim columns for small screens.

## Images

Images are block content. One is always full width, and an image typed into the middle of a sentence is lifted out, with the paragraph splitting around it. Insert them with the Image button in the toolbar, which does three things you would otherwise have to remember:

1. It downscales and re-encodes the file in the browser, so a 12 MB phone photo lands as a sensible web image.
2. It writes the file into your own folder in the `blog-images` bucket, the only place a body image is allowed to come from.
3. It bakes the finished pixel size into the filename, so the page reserves the right box and the text does not jump as images load.

What it leaves in the text looks like this:

```
![Scaled marks by subject](3f9c1a2b-4d5e-6f70-8192-a3b4c5d6e7f8/body-1770000000000-a1b2c3-1600x900.webp)
```

Type a path by hand and you get nothing useful, which is the intent. An image aimed at another website degrades to its alt text instead of loading: ![this sentence is the alt text of an image pointed at example.com](https://example.com/tracker.png) An image tag fires a request with no click at all, so allowing one would hand a stranger the IP address of every reader.

There is no real figure in this demo because a real one has to be uploaded first. Drop one in from the toolbar to see the frame and the caption treatment.

## What the parser refuses

The pipeline runs Markdown, then a fixed set of nodes, then React. It never builds an HTML string, so there is nothing to escape and nothing to get wrong:

- Raw HTML is not parsed. Typing a script tag gets you the literal characters <script>alert("hi")</script> in the middle of your sentence, and nothing else.
- A link to javascript:, or an image whose source is a data: URL, is refused outright and the raw text you typed survives in its place.
- Footnotes are not supported. A fenced code block keeps its text and loses its styling, like the one above.

None of that asks the author to be careful. It holds for anything typed into the field, which is why writing access is a capability granted by hand rather than a review queue bolted onto the editor.

## How the page is assembled

Nothing on this page is stored twice:

| On the page | Where it comes from |
| --- | --- |
| The contents rail | Every `##` heading, slugified into an anchor |
| The reading time | A word count of the parsed body, at 200 words a minute |
| The byline | A live join to the author's tutor profile |
| The spacing | Applied by the renderer, never stored |

*Derived rather than authored, so none of it goes stale when the copy is edited.*

The byline earns one extra line. It links through to the author's public tutor profile when there is one to link to, and degrades to a plain name, or to nothing, when that profile is hidden or the account is disabled. An author leaving does not take their articles down with them.

## Publishing

An article has a status, and the editor deals in two of them:

1. **Draft.** Saved, fully editable, and invisible to everyone but you. This article is a draft right now, which is exactly why it is not sitting on `/blog`.
2. **Published.** Live at its slug and listed newest first on the index, stamped with a publish date the first time it goes out. Later edits set an "Updated" date instead, so republishing an old article does not shove it back to the top.

Preview in the editor runs the real renderer, so what you see there is what readers get. When you have finished reading, press Publish to put this on the site, or leave it where it is and it stays in drafts.
$md$,
  'draft',
  t.id
from public.tutor_profiles t
where t.slug = current_setting('util.author_slug')
on conflict (slug) do update set
  title              = excluded.title,
  excerpt            = excluded.excerpt,
  category           = excluded.category,
  body_md            = excluded.body_md,
  status             = excluded.status,
  author_id          = excluded.author_id,
  published_at       = null,
  content_updated_at = null;

commit;

-- Sanity check — the row, its author, and whether that author can actually open
-- /author to read it (the page is gated on can_author_articles; without it the
-- guard redirects them home even though the row is theirs).
select a.slug,
       a.title,
       a.status,
       a.published_at,
       p.full_name as author,
       p.role,
       p.can_author_articles,
       length(a.body_md) as body_chars
from public.articles a
left join public.profiles p on p.id = a.author_id
where a.slug = 'demo-blog-editor-tour';
