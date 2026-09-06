// ============================================================================
// Blog data access.
// ----------------------------------------------------------------------------
// The ONLY path to article data, exactly as lib/supabase/tutors.js is the only
// path to tutor data. Articles are rows in `articles` (migration 0061); they
// used to be JSX modules under content/blog/, and closing that seam is what
// this file's rewrite was for.
//
// Every read takes a supabase client as its first argument and never imports
// one, matching lib/supabase/tutors.js and lib/supabase/reviews.js. That is a
// deliberate break with the old no-argument signatures: it costs two call sites
// and buys consistency with every other query helper in the repo.
//
// formatArticleDate is the exception and stays pure and synchronous: it is
// string formatting, not data access, and client components call it.
// ============================================================================

import { parseArticleBody, articlePlainText } from "@/lib/markdown";

const WORDS_PER_MINUTE = 200;

const BLOG_IMAGES_BUCKET = "blog-images";

// The author embed is a LEFT join, NOT `author:tutor_profiles!inner`, and that
// is load-bearing. 0055's policies hide a disabled account's profiles and
// tutor_profiles rows, so an inner join would silently unpublish every article
// its author ever wrote the moment their account was disabled. Left-joined,
// PostgREST returns null for the embed, ArticleByline already renders nothing
// without a name, and the article stays up. Account status governs the account;
// articles.status governs the article, and taking one down is a separate,
// deliberate act.
const ARTICLE_CARD_SELECT = `
  slug,
  title,
  excerpt,
  category,
  cover_path,
  cover_alt,
  published_at,
  content_updated_at,
  author:tutor_profiles (
    slug,
    visibility,
    avatar_url,
    avatar_bg,
    initials,
    bio,
    profile:profiles ( full_name )
  )
`;

// The card fields plus the Markdown body. Only the article page needs the body,
// and it is by far the largest column, so the index query deliberately never
// asks — which is also why parsing per request costs one article, not five.
const ARTICLE_DETAIL_SELECT = `body_md, ${ARTICLE_CARD_SELECT}`;

/** Pure string building, no network call — same as tutorDocUrl in storage.js. */
function coverUrl(supabase, path) {
  if (!path) return null;
  const { data } = supabase.storage.from(BLOG_IMAGES_BUCKET).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

// The byline shape the article page expects. `roleLine` is the tutor's own
// tagline (tutor_profiles.bio) rather than a line stored per article.
//
// tutorSlug is gated on visibility because 0055's tutor_profiles policy checks
// profiles.status but NOT visibility, so an unlisted or hidden tutor would
// otherwise get a byline link straight to a 404. Null here means the byline
// renders as plain text, which is what the old resolveAuthorHref achieved with
// an extra query per page render.
function articleAuthor(row) {
  const tutor = row.author;
  const name = tutor?.profile?.full_name;
  if (!tutor || !name) return null;
  return {
    name,
    roleLine: tutor.bio ?? null,
    avatar: tutor.avatar_url ?? null,
    initials: tutor.initials ?? null,
    avatarBg: tutor.avatar_bg ?? null,
    tutorSlug: tutor.visibility === "public" ? tutor.slug : null,
  };
}

// Explicit, hand-written snake -> camel, like tutorRowToCard. There is no
// generic mapper in this repo on purpose: the renames are not mechanical
// (content_updated_at is the reader-visible "Updated" date, and it is a
// different column from the row's bookkeeping updated_at).
function articleRowToCard(supabase, row) {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? null,
    category: row.category ?? null,
    coverUrl: coverUrl(supabase, row.cover_path),
    coverAlt: row.cover_alt ?? null,
    publishedAt: row.published_at ?? null,
    updatedAt: row.content_updated_at ?? null,
    author: articleAuthor(row),
  };
}

/** Published article metadata, newest first. Powers the /blog index. */
export async function getArticles(supabase) {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_CARD_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return data.map((row) => articleRowToCard(supabase, row));
}

/**
 * One article with its body, or null when the slug is unknown or unpublished.
 * Null-on-miss mirrors getTutorBySlug, so the page can call notFound().
 */
export async function getArticleBySlug(supabase, slug) {
  if (!slug) return null;

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_DETAIL_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !data) return null;

  // Markdown becomes nodes here, once, and the page below never sees the source.
  // `sections` keeps its name because ArticleToc and the page already consume
  // that shape; what changed is where it comes from.
  const sections = parseArticleBody(data.body_md);
  return {
    ...articleRowToCard(supabase, data),
    sections,
    readingMinutes: readingMinutes(sections),
  };
}

/**
 * "Keep reading" picks: same category first (newest first), then the newest of
 * everything else. Deterministic, so the server render is stable.
 */
export async function getRelatedArticles(supabase, slug, limit = 3) {
  const all = await getArticles(supabase);
  const others = all.filter((a) => a.slug !== slug);
  const current = all.find((a) => a.slug === slug);
  if (!current) return others.slice(0, limit);
  const sameCategory = others.filter((a) => a.category === current.category);
  const rest = others.filter((a) => a.category !== current.category);
  return [...sameCategory, ...rest].slice(0, limit);
}

// Locale AND time zone are pinned, and the month name comes from the table
// below rather than from ICU, for the reasons spelled out in full in
// app/tutor/[slug]/ReviewItem.jsx: anything left to the runtime renders
// differently on the server and in the browser, which is a hydration error.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SYDNEY_PARTS = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Australia/Sydney",
});

/** "2026-02-10" to "10 Feb 2026". Empty string on an unparseable date. */
export function formatArticleDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const p = Object.fromEntries(SYDNEY_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

// Reading time is computed from the body rather than authored in metadata, so
// it can't go stale when the copy is edited. It counts the PARSED nodes rather
// than the Markdown source, so syntax (list markers, table pipes, link URLs)
// never inflates the number.
export function readingMinutes(sections) {
  const words = articlePlainText(sections).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

// ==== Authoring ============================================================
// Writes go through the user-scoped client so the 0061 RLS is the enforcement:
// the caller must own the row AND hold profiles.can_author_articles. Nothing
// here re-checks the capability, deliberately — a second check in JS would be a
// second thing to keep in sync, and the policy is the one that actually binds.

const MY_ARTICLE_SELECT = `
  id, slug, title, excerpt, category, body_md,
  cover_path, cover_alt, status, published_at, content_updated_at, updated_at
`;

/** Every article this user owns, any status, most recently touched first. */
export async function getMyArticles(supabase, authorId) {
  if (!authorId) return [];
  const { data, error } = await supabase
    .from("articles")
    .select(MY_ARTICLE_SELECT)
    .eq("author_id", authorId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => myArticleRow(supabase, row));
}

/** One of the user's own articles by id, or null. RLS scopes it to the owner. */
export async function getMyArticleById(supabase, id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from("articles")
    .select(MY_ARTICLE_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return myArticleRow(supabase, data);
}

function myArticleRow(supabase, row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    category: row.category ?? "",
    bodyMd: row.body_md ?? "",
    coverPath: row.cover_path ?? null,
    coverUrl: coverUrl(supabase, row.cover_path),
    coverAlt: row.cover_alt ?? "",
    status: row.status,
    publishedAt: row.published_at ?? null,
    updatedAt: row.content_updated_at ?? null,
  };
}

/**
 * Create or update one article. `id` absent means insert.
 *
 * Returns { ok, article?, error? } and never throws, matching
 * lib/supabase/storage.js. A duplicate slug comes back as a readable message
 * rather than a raw 23505, since that is the one error an author will actually
 * hit.
 */
export async function saveArticle(supabase, authorId, input) {
  if (!authorId) return { ok: false, error: "Not signed in." };

  const row = {
    author_id: authorId,
    slug: (input.slug || "").trim(),
    title: (input.title || "").trim(),
    excerpt: blankToNull(input.excerpt),
    category: blankToNull(input.category),
    body_md: blankToNull(input.bodyMd),
    cover_path: input.coverPath ?? null,
    cover_alt: blankToNull(input.coverAlt),
    status: input.status || "draft",
    published_at: input.publishedAt ?? null,
    content_updated_at: input.contentUpdatedAt ?? null,
  };

  if (!row.slug) return { ok: false, error: "A URL slug is required." };
  if (!row.title) return { ok: false, error: "A title is required." };

  const query = input.id
    ? supabase.from("articles").update(row).eq("id", input.id)
    : supabase.from("articles").insert(row);

  const { data, error } = await query.select(MY_ARTICLE_SELECT).single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: `The slug "${row.slug}" is already taken.` };
    }
    // An RLS refusal surfaces as an empty result rather than a useful message,
    // so say the thing that is almost always true when a write is rejected.
    console.error("[saveArticle]", error);
    return { ok: false, error: "Could not save. You may not have authoring access." };
  }

  return { ok: true, article: myArticleRow(supabase, data) };
}

/**
 * Publish or unpublish. Stamps published_at the first time an article goes
 * live and leaves it alone afterwards, so re-publishing after an edit does not
 * move the article back to the top of /blog.
 */
export async function setArticleStatus(supabase, id, status, { publishedAt } = {}) {
  const patch = { status };
  if (status === "published" && publishedAt === null) {
    patch.published_at = new Date().toISOString().slice(0, 10); // date column
  }

  const { data, error } = await supabase
    .from("articles")
    .update(patch)
    .eq("id", id)
    .select("id, status, published_at")
    .single();

  if (error || !data) {
    console.error("[setArticleStatus]", error);
    return { ok: false, error: "Could not update this article." };
  }
  return { ok: true, status: data.status, publishedAt: data.published_at };
}

function blankToNull(v) {
  const s = typeof v === "string" ? v.trim() : v;
  return s ? s : null;
}
