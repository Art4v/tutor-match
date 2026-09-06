// ============================================================================
// Article Markdown -> renderable nodes.
// ----------------------------------------------------------------------------
// The single place Markdown becomes something the site can render, exactly as
// lib/blog.js is the single path to article data. articles.body_md (0061) holds
// Markdown; app/blog/[slug]/ArticleBody.jsx renders the node tree this file
// produces. Nothing in between ever produces an HTML string.
//
// SECURITY, in one paragraph, because it is the reason this file is shaped the
// way it is. `html: false` means raw HTML in the source is never parsed as
// HTML — it survives as ordinary text and React escapes it on the way out. On
// top of that, tokenToBlocks and inlineToNodes are a WHITELIST: a token type
// with no case in the switch is dropped, so a construct we have not thought
// about cannot reach the page. That is what makes it safe to hand authors a
// text field. Do NOT "fix" an unsupported construct by emitting HTML, and do
// not turn `html` on. The repo has zero dangerouslySetInnerHTML and this is the
// one file where that would be tempting.
//
// The node shape is documented in ArticleBody.jsx, which is its only consumer.
// ============================================================================

import MarkdownIt from "markdown-it";
import container from "markdown-it-container";

// `html: false` is load-bearing (see above). `linkify` is off deliberately: an
// author who types a bare URL gets a bare URL, which is easier to explain than
// autolinking that fires in the middle of prose.
const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

// Markdown has no callout, so it gets a fenced container:
//
//   :::callout The test of a good timetable
//   You should be able to lose an entire evening and still be on track.
//   :::
//
// The title is optional; everything after the marker on the opening line is it.
md.use(container, "callout");

// Only these schemes may appear in an href. markdown-it does its own link
// validation, but the allowlist belongs here with the rest of the whitelist
// rather than being delegated to a dependency's default configuration.
// Site-relative links (starting "/" or "#") are allowed and everything else,
// notably javascript: and data:, is dropped back to plain text.
function safeHref(raw) {
  if (typeof raw !== "string") return null;
  const href = raw.trim();
  if (!href) return null;
  if (href.startsWith("/") || href.startsWith("#")) return href;
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  return null;
}

// The image counterpart of safeHref, and stricter on purpose: an href may point
// anywhere on the web, an image may not. An <img src> fires a request with no
// user action at all, carrying the reader's IP, user-agent and referrer to
// whoever owns the host, so this is an allowlist of one SHAPE rather than of
// schemes. The only thing that may be an image src is a path inside the
// blog-images bucket, in the <author-uuid>/<filename> form
// uploadArticleBodyImage writes. That is what makes hotlinking and tracking
// pixels impossible in a body, and it is also why bodies store a PATH rather
// than a URL (the public URL is built at render time, in ArticleBody.jsx).
//
// Anchored both ends, so "https://evil.com/#a1b2.../x.png" cannot match on a
// substring. The single-slash shape is what kills traversal: the basename class
// excludes "/" and the first character must be alphanumeric, so "uid/.." and
// "uid/../../x" both fail. That leading-character rule is load-bearing, not
// decoration, because "." IS legal later in the basename (you need it for
// ".webp").
//
// Note what this does NOT catch, because the credit belongs upstream:
// markdown-it's own validateLink rejects data: and javascript: destinations
// before an image token is ever created, so those never reach here at all and
// the raw "![x](data:...)" survives as inert TEXT rather than degrading to its
// alt text the way a rejected https:// image does. Two layers, two different
// output shapes, both safe. Do not "simplify" by relying on only one of them.
//
// LIMIT, deliberate: this proves the first segment is *a* uuid, not *this
// author's* uuid. Hand-typing another author's uuid yields an <img> pointing at
// an already-public object in the same public bucket, which is intra-bucket
// hotlinking rather than a privacy or XSS issue. Closing it would mean
// threading author_id through parseArticleBody, a pure (markdown) -> Section[]
// called from both the article page and the client editor preview.
const BODY_IMAGE_PATH =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/i;

function safeImagePath(raw) {
  if (typeof raw !== "string") return null;
  const src = raw.trim();
  return src && BODY_IMAGE_PATH.test(src) ? src : null;
}

// Intrinsic size travels in the FILENAME (body-<epochms>-<rand>-<w>x<h>.<ext>)
// rather than in the Markdown or a column, so the renderer can reserve the box
// and the page does not reflow as images land. No new syntax, no new column,
// and nothing to keep in sync: the uploader is the only writer of these names.
// Anchored on the extension, so extra filename segments do not break it and a
// hand-typed path simply yields {} and renders unsized.
const IMAGE_DIMS = /-(\d{1,5})x(\d{1,5})\.[a-z0-9]+$/i;

function dimensionsFromPath(path) {
  const m = IMAGE_DIMS.exec(path);
  if (!m) return {};
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h || w > 20000 || h > 20000) return {};
  return { w, h };
}

/** Flatten an inline token's children into the Inline union. */
function inlineToNodes(children) {
  const nodes = [];
  // Marks are tracked as counters rather than a stack because the Inline union
  // is flat: bold-inside-a-link renders as a link, not as both. Prose does not
  // need nesting and a flat model keeps the renderer trivial.
  let bold = 0;
  let italic = 0;
  let link = null; // { href, text } while inside a link_open/link_close pair

  const push = (text) => {
    if (!text) return;
    if (link) {
      link.text += text;
      return;
    }
    if (bold > 0) nodes.push({ b: text });
    else if (italic > 0) nodes.push({ i: text });
    else nodes.push(text);
  };

  for (const t of children || []) {
    switch (t.type) {
      case "text":
        push(t.content);
        break;
      // A backtick span keeps its CONTENT but loses its styling. Dropping the
      // token outright would silently delete words, which is worse.
      case "code_inline":
        push(t.content);
        break;
      // An image that reaches HERE is in an inline context a figure cannot
      // enter: a heading, a table cell, a list item, or inside a link. It
      // degrades to its alt text for the same reason code_inline does, because
      // dropping the token silently deletes the author's words. An image in a
      // top-level paragraph never reaches here -- paragraphBlocks promotes
      // those to figures first.
      //
      // The alt comes from the token's CHILDREN, not its `content`: content is
      // the raw source ("a **b**"), and literal asterisks in alt text are wrong.
      case "image":
        push(flattenText(inlineToNodes(t.children)));
        break;
      case "softbreak":
      case "hardbreak":
        push(" ");
        break;
      case "strong_open":
        bold++;
        break;
      case "strong_close":
        bold = Math.max(0, bold - 1);
        break;
      case "em_open":
        italic++;
        break;
      case "em_close":
        italic = Math.max(0, italic - 1);
        break;
      case "link_open": {
        const href = safeHref(t.attrGet && t.attrGet("href"));
        link = { href, text: "" };
        break;
      }
      case "link_close": {
        if (link) {
          // A rejected scheme degrades to the link's own text, so the words
          // survive and the dangerous href does not.
          if (link.href) nodes.push({ href: link.href, text: link.text });
          else if (link.text) nodes.push(link.text);
          link = null;
        }
        break;
      }
      // Everything else (html_inline, footnotes, ...) is dropped.
      default:
        break;
    }
  }

  // An unclosed link at end of input still yields its text.
  if (link?.text) nodes.push(link.href ? { href: link.href, text: link.text } : link.text);

  return nodes;
}

/** Collect the inline nodes of every `inline` token between open/close. */
function collectInline(tokens, i) {
  const t = tokens[i];
  return t && t.type === "inline" ? inlineToNodes(t.children) : [];
}

/** Inline[] -> its plain text. Shared by headings, table head cells and alt. */
function flattenText(nodes) {
  return nodes
    .map((n) => (typeof n === "string" ? n : n.b ?? n.i ?? n.text ?? ""))
    .join("")
    .trim();
}

/** Plain text of an inline token, for headings and table head cells. */
function inlineText(tokens, i) {
  return flattenText(collectInline(tokens, i));
}

// ---------------------------------------------------------------------------
// Token stream -> Block[]
// ---------------------------------------------------------------------------
// Walks a token range and returns blocks. Recurses for containers (callouts,
// blockquotes) by walking the tokens between their open and close.

/** True when a run has at least one non-blank word in it. */
function hasProse(nodes) {
  return nodes.some((n) =>
    Boolean(String(typeof n === "string" ? n : n.b ?? n.i ?? n.text ?? "").trim()),
  );
}

/** An image token -> a figure block, or null when its src is not allowlisted. */
function imageBlock(token) {
  const path = safeImagePath(token.attrGet && token.attrGet("src"));
  if (!path) return null;
  const alt = flattenText(inlineToNodes(token.children));
  return { type: "figure", path, ...(alt ? { alt } : {}), ...dimensionsFromPath(path) };
}

/**
 * One paragraph's inline token stream -> the blocks it produces.
 *
 * Images are BLOCK content in this system (full-width figures, no float, no
 * width option), so a mid-sentence image is PROMOTED out of the paragraph and
 * the paragraph splits around it:
 *
 *   Some text ![a](uid/x.webp) more text   ->   p, figure, p
 *
 * Nothing is ever lost: an image whose src fails safeImagePath is not a split
 * point and falls through to inlineToNodes, which keeps its alt text as words.
 *
 * Two behaviours that look like bugs and are not:
 *
 * 1. MARK STATE DOES NOT SURVIVE A SPLIT. Each side is a separate
 *    inlineToNodes call, so the bold/italic counters restart at the boundary.
 *    `**before ![a](x) after**` renders "before" bold and "after" plain.
 *    Threading mark state across the split would mean returning it from
 *    inlineToNodes or re-deriving it, and nobody puts an image inside a bold
 *    run on purpose.
 * 2. ADJACENT STRING RUNS ARE NEVER JOINED, here or anywhere else in this
 *    file. `one ![a](x) two` in a list item yields ["one ", "a", " two"],
 *    which renders identically. Do not add a join step; nothing else in the
 *    Inline union has one.
 */
function paragraphBlocks(inline) {
  const children = inline && inline.type === "inline" ? inline.children || [] : [];
  const out = [];
  let seg = [];
  let linkDepth = 0;

  const flush = () => {
    const nodes = inlineToNodes(seg);
    // hasProse, not nodes.length: a trailing " " left behind by a split would
    // otherwise emit an empty <p> carrying a visible mt-4 gap under the figure.
    if (hasProse(nodes)) out.push({ type: "p", text: nodes });
    seg = [];
  };

  for (const t of children) {
    if (t.type === "link_open") linkDepth++;
    else if (t.type === "link_close") linkDepth = Math.max(0, linkDepth - 1);

    // An image inside a link is NOT a split point. Breaking a link in half is
    // worse than losing the figure treatment, so it falls through to
    // inlineToNodes' case "image" and its alt text joins the link's text.
    const fig = t.type === "image" && linkDepth === 0 ? imageBlock(t) : null;
    if (fig) {
      flush();
      out.push(fig);
      continue;
    }
    seg.push(t);
  }
  flush();
  return out;
}

function blocksFrom(tokens, start, end) {
  const blocks = [];
  let i = start;

  while (i < end) {
    const t = tokens[i];

    switch (t.type) {
      case "paragraph_open": {
        for (const b of paragraphBlocks(tokens[i + 1])) blocks.push(b);
        i = skipTo(tokens, i, "paragraph_close");
        break;
      }

      case "heading_open": {
        // h1/h2 are section breaks and are handled by the caller, so anything
        // reaching here is a sub-heading inside a section.
        blocks.push({ type: "h3", text: inlineText(tokens, i + 1) });
        i = skipTo(tokens, i, "heading_close");
        break;
      }

      case "bullet_list_open":
      case "ordered_list_open": {
        const type = t.type === "bullet_list_open" ? "ul" : "ol";
        const close = t.type === "bullet_list_open" ? "bullet_list_close" : "ordered_list_close";
        const end_ = matchingClose(tokens, i, t.type, close);
        blocks.push({ type, items: listItems(tokens, i + 1, end_) });
        i = end_ + 1;
        break;
      }

      case "container_callout_open": {
        const end_ = matchingClose(
          tokens,
          i,
          "container_callout_open",
          "container_callout_close",
        );
        const title = (t.info || "").trim().replace(/^callout\s*/i, "").trim();
        blocks.push({
          type: "callout",
          ...(title ? { title } : {}),
          content: blocksFrom(tokens, i + 1, end_),
        });
        i = end_ + 1;
        break;
      }

      // A blockquote is the no-title callout. Authors reach for `>` before they
      // read the docs, so it lands somewhere sensible rather than vanishing.
      case "blockquote_open": {
        const end_ = matchingClose(tokens, i, "blockquote_open", "blockquote_close");
        blocks.push({ type: "callout", content: blocksFrom(tokens, i + 1, end_) });
        i = end_ + 1;
        break;
      }

      case "table_open": {
        const end_ = matchingClose(tokens, i, "table_open", "table_close");
        const table = readTable(tokens, i, end_);
        if (table) blocks.push(table);
        i = end_ + 1;
        break;
      }

      // Content-preserving fallbacks: a code block keeps its text as a
      // paragraph rather than disappearing.
      case "fence":
      case "code_block": {
        const text = String(t.content || "").trim();
        if (text) blocks.push({ type: "p", text: [text] });
        i++;
        break;
      }

      default:
        i++;
        break;
    }
  }

  return attachCaptions(blocks);
}

/**
 * Markdown has no caption, so: a paragraph directly after a table OR a figure
 * whose whole content is italic becomes that block's caption.
 *
 *   | Slot | Weeknight |
 *   | --- | --- |
 *   | Block 1 | Hardest subject |
 *
 *   *A template, not a prescription.*
 *
 *   ![Scaled marks by subject](uid/body-1-800x600.webp)
 *
 *   *Source: NESA 2025 scaling report.*
 *
 * The rule is narrow on purpose (entirely italic, immediately after) so an
 * ordinary emphasised sentence somewhere else in the prose can't be swallowed.
 * It runs on the OUTPUT of the whole blocksFrom loop, so a figure promoted out
 * of a paragraph is already in the list by the time this sees it.
 *
 * Corollary worth knowing: `![a](x) more text` followed by *Caption.* attaches
 * the caption to the trailing PARAGRAPH, not the figure, because that trailing
 * paragraph sits between them.
 */
function attachCaptions(blocks) {
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    const isItalicOnlyParagraph =
      next &&
      next.type === "p" &&
      Array.isArray(next.text) &&
      next.text.length === 1 &&
      typeof next.text[0]?.i === "string";

    const takesCaption = b.type === "table" || b.type === "figure";
    if (takesCaption && !b.caption && isItalicOnlyParagraph) {
      out.push({ ...b, caption: next.text[0].i });
      i++; // consume the caption paragraph
      continue;
    }
    out.push(b);
  }
  return out;
}

function skipTo(tokens, i, closeType) {
  let j = i + 1;
  while (j < tokens.length && tokens[j].type !== closeType) j++;
  return j + 1;
}

/** Index of the close token matching the open at `i`, honouring nesting. */
function matchingClose(tokens, i, openType, closeType) {
  let depth = 0;
  for (let j = i; j < tokens.length; j++) {
    if (tokens[j].type === openType) depth++;
    else if (tokens[j].type === closeType) {
      depth--;
      if (depth === 0) return j;
    }
  }
  return tokens.length - 1;
}

/**
 * List items as Inline[][]. A list item is usually one paragraph, so its inline
 * runs are concatenated; a multi-paragraph item is joined with a space rather
 * than growing the node union for a case prose does not need.
 */
function listItems(tokens, start, end) {
  const items = [];
  let i = start;
  while (i < end) {
    if (tokens[i].type === "list_item_open") {
      const close = matchingClose(tokens, i, "list_item_open", "list_item_close");
      const parts = [];
      for (let j = i + 1; j < close; j++) {
        if (tokens[j].type === "inline") {
          if (parts.length) parts.push(" ");
          parts.push(...inlineToNodes(tokens[j].children));
        }
      }
      items.push(parts);
      i = close + 1;
    } else {
      i++;
    }
  }
  return items;
}

function readTable(tokens, start, end) {
  const head = [];
  const rows = [];
  let inHead = false;
  let current = null;

  for (let i = start; i <= end; i++) {
    const t = tokens[i];
    if (t.type === "thead_open") inHead = true;
    else if (t.type === "thead_close") inHead = false;
    else if (t.type === "tr_open") current = [];
    else if (t.type === "tr_close") {
      if (current && current.length && !inHead) rows.push(current);
      current = null;
    } else if (t.type === "th_open") {
      head.push(inlineText(tokens, i + 1));
    } else if (t.type === "td_open") {
      if (current) current.push(collectInline(tokens, i + 1));
    }
  }

  if (!head.length && !rows.length) return null;
  return { type: "table", head, rows };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** "How your aggregate is built" -> "how-your-aggregate-is-built" */
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Markdown -> the Section[] the article page renders.
 *
 * `#` and `##` both start a section: the page already renders the title as the
 * only h1, so an author who reaches for `#` means "new section" and gets it.
 * `###` and deeper stay inside a section as sub-headings. Anything before the
 * first heading becomes a leading section with no heading, which renders
 * without an h2 and is skipped by the table of contents.
 *
 * Section ids come from the heading text, which is what makes the TOC anchors
 * and the deep links in ArticleToc.jsx work without being authored by hand.
 */
export function parseArticleBody(markdown) {
  if (!markdown || typeof markdown !== "string") return [];

  const tokens = md.parse(markdown, {});

  // Split the top-level token stream on h1/h2 boundaries first, then convert
  // each run to blocks, so a heading inside a callout or a list can never be
  // mistaken for a section break.
  const groups = [];
  let current = { heading: null, start: 0, end: 0 };
  let depth = 0;
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t.nesting === 1) depth++;
    else if (t.nesting === -1) depth--;

    const isSectionHeading =
      t.type === "heading_open" && depth === 1 && (t.tag === "h1" || t.tag === "h2");

    if (isSectionHeading) {
      current.end = i;
      if (current.end > current.start || current.heading) groups.push(current);
      const close = matchingClose(tokens, i, "heading_open", "heading_close");
      current = { heading: inlineText(tokens, i + 1), start: close + 1, end: close + 1 };
      // The heading's own open/close tokens are balanced, so depth is unchanged.
      depth = 0;
      i = close + 1;
      continue;
    }
    i++;
  }
  current.end = tokens.length;
  if (current.end > current.start || current.heading) groups.push(current);

  const used = new Set();
  const sections = [];

  for (const g of groups) {
    const content = blocksFrom(tokens, g.start, g.end);
    if (!content.length && !g.heading) continue;

    let id = slugify(g.heading) || `section-${sections.length + 1}`;
    if (used.has(id)) {
      let n = 2;
      while (used.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    used.add(id);

    sections.push({ id, heading: g.heading || null, content });
  }

  return sections;
}

/** The article as plain text, for word counts. */
/**
 * Every blog-images path a body image references, with its alt text. Parses
 * with the real parser rather than regexing the source, so it agrees exactly
 * with what renders: an ![]() inside a fenced code block is not an image here
 * either. One definition of "a body image", shared by the editor's blank-alt
 * hint and the delete sweep in ArticleEditor.
 *
 * Deliberately returns EVERY referenced path, including images in headings,
 * cells and links that never become figures, because for cleanup purposes they
 * are still uploaded objects sitting in the bucket.
 */
export function articleImages(markdown) {
  if (!markdown || typeof markdown !== "string") return [];
  const out = [];
  const walk = (tokens) => {
    for (const t of tokens || []) {
      if (t.type === "image") {
        const path = safeImagePath(t.attrGet && t.attrGet("src"));
        if (path) out.push({ path, alt: flattenText(inlineToNodes(t.children)) });
      }
      if (t.children) walk(t.children);
    }
  };
  walk(md.parse(markdown, {}));
  return out;
}

export function articlePlainText(sections) {
  const out = [];
  const walk = (value) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string") {
      out.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        // `type` is a discriminator, `id` an anchor slug, `href` a URL, `path`
        // a storage key, `alt` an accessibility attribute: none of them are
        // prose and none should count towards reading time. A figure's
        // `caption` DOES count -- it is copy printed on the page, exactly like
        // a table's. `alt` is skipped because a screen-reader user hears it
        // INSTEAD of the image rather than in addition to prose, and because
        // skipping it keeps the published "N min read" independent of whether
        // the author filled alt in. `w`/`h` need no entry: this walker only
        // collects strings, so numbers fall off the end and are ignored.
        if (
          key === "type" ||
          key === "id" ||
          key === "href" ||
          key === "path" ||
          key === "alt"
        )
          continue;
        walk(child);
      }
    }
  };
  walk(sections);
  return out.join(" ");
}
