// ============================================================================
// Blog data access.
// ----------------------------------------------------------------------------
// The ONLY path to article data, exactly as lib/supabase/tutors.js is the only
// path to tutor data. Articles currently live as JSX modules in content/blog/,
// but every function here is async and shaped like a Supabase query helper, so
// the future "blogger role" slice can move the store into an `articles` table
// (see CLAUDE.md) by reimplementing this file alone. No page or component
// touches the manifest directly.
// ============================================================================

import { ARTICLES } from "@/content/blog/manifest";

const WORDS_PER_MINUTE = 200;

// Only `published` articles are public. This is the file-era stand-in for the
// future table's public SELECT policy (`status = 'published'`).
function published() {
  return ARTICLES.filter((a) => a.meta.status === "published");
}

// Newest first. publishedAt is a plain ISO date string, so a string compare is
// a date compare, and it can't drift with time zones the way Date parsing can.
function newestFirst(a, b) {
  return (b.meta.publishedAt || "").localeCompare(a.meta.publishedAt || "");
}

/** Published article metadata, newest first. Powers the /blog index. */
export async function getArticles() {
  return published().sort(newestFirst).map((a) => a.meta);
}

/**
 * One article with its body, or null when the slug is unknown or unpublished.
 * Null-on-miss mirrors getTutorBySlug, so the page can call notFound().
 */
export async function getArticleBySlug(slug) {
  if (!slug) return null;
  const found = published().find((a) => a.meta.slug === slug);
  if (!found) return null;
  return {
    ...found.meta,
    sections: found.sections,
    readingMinutes: readingMinutes(found.sections),
  };
}

/**
 * "Keep reading" picks: same category first (newest first), then the newest of
 * everything else. Deterministic, so the server render is stable.
 */
export async function getRelatedArticles(slug, limit = 3) {
  const current = published().find((a) => a.meta.slug === slug);
  const others = published()
    .filter((a) => a.meta.slug !== slug)
    .sort(newestFirst)
    .map((a) => a.meta);
  if (!current) return others.slice(0, limit);
  const sameCategory = others.filter((m) => m.category === current.meta.category);
  const rest = others.filter((m) => m.category !== current.meta.category);
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
// it can't go stale when the copy is edited. The walker counts the words in the
// rendered text of a JSX tree: strings and numbers count, elements recurse into
// their children, and CUSTOM components (Callout, Table) also have their other
// props walked, since those carry text that never appears as children.
const SKIP_PROPS = new Set(["className", "style", "id", "href", "key", "ref"]);

function countWords(node) {
  if (node === null || node === undefined || typeof node === "boolean") return 0;
  if (typeof node === "string") {
    const words = node.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }
  if (typeof node === "number") return 1;
  if (Array.isArray(node)) return node.reduce((n, child) => n + countWords(child), 0);
  if (typeof node === "object" && node.props) {
    let total = countWords(node.props.children);
    if (typeof node.type === "function") {
      for (const [name, value] of Object.entries(node.props)) {
        if (name === "children" || SKIP_PROPS.has(name)) continue;
        total += countWords(value);
      }
    }
    return total;
  }
  return 0;
}

function readingMinutes(sections) {
  const words = (sections || []).reduce(
    (n, s) => n + countWords(s.heading) + countWords(s.content),
    0,
  );
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
