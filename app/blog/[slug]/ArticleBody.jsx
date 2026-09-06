import { Callout, Figure, Table } from "./prose";
import { blogImageUrl } from "@/lib/supabase/storage";

// ============================================================================
// Renders one article section's `content`. The nodes come from lib/markdown.js,
// which parses articles.body_md (migration 0061); this is the ONLY thing that
// renders that shape.
//
// It is a whitelist, and that is the whole point: an unrecognised node renders
// NOTHING. Article bodies ARE author-supplied, and there is no escape from a
// switch that only knows six node types, which is why the pipeline is
// Markdown -> nodes -> JSX and never touches an HTML string. Together with
// `html: false` in lib/markdown.js this is what keeps the repo's zero
// dangerouslySetInnerHTML true. components/RichText.jsx does the same thing for
// tutor-authored bios, one level simpler.
//
// The shape, which is also documented on the column:
//
//   Section = { id: string, heading: string, content: Block[] }
//
//   Block =
//     | { type: "p",       text: Inline[] }
//     | { type: "h3",      text: string }
//     | { type: "ul",      items: Inline[][] }
//     | { type: "ol",      items: Inline[][] }
//     | { type: "callout", title?: string, content: Block[] }
//     | { type: "table",   head: string[], rows: Cell[][], caption?: string }
//     | { type: "figure",  path: string, alt?: string, w?: number, h?: number,
//                          caption?: string }
//
//   Inline = string              // plain text
//          | { b: string }       // the font-medium run
//          | { i: string }       // emphasis
//          | { href, text }      // link; href is scheme-checked at parse time
//   Cell   = string | Inline[]
//
// Anywhere Inline[] is expected a bare Inline is accepted too, so a paragraph
// with no bold in it is just { type: "p", text: "one plain sentence." }.
//
// A figure stores a STORAGE PATH inside the blog-images bucket, never a URL, so
// a dump restored into another Supabase project is not full of dead images. The
// public URL is built HERE, at render time, from NEXT_PUBLIC_SUPABASE_URL. The
// path is allowlisted at PARSE time (safeImagePath in lib/markdown.js) to the
// <author-uuid>/<filename> shape the uploader writes, which is what makes
// hotlinking and tracking pixels impossible in a body. `w`/`h` are the
// intrinsic pixel size, carried in the FILENAME rather than in the Markdown or
// a column, and they are what stops the page reflowing as images land.
//
// SPACING IS MECHANICAL, NOT STORED. Every paragraph after the first carries
// mt-4 and every list carries mt-3, because Tailwind's preflight zeroes those
// margins; Callout and Table own their my-6. Storing a className per node would
// put arbitrary Tailwind in the database, and worse, Tailwind generates classes
// by scanning SOURCE TEXT, so a class that existed only as a jsonb string would
// never be generated and the copy would render unstyled with no build error.
// Every class this file emits is therefore written out as a literal below.
// ============================================================================

/** Inline runs: a bare string, { b }, { i }, or a link. */
function renderInline(nodes, keyPrefix = "") {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  return list.map((node, i) => {
    if (node === null || node === undefined) return null;
    if (typeof node === "string") return node;
    if (typeof node !== "object") return null;

    if (typeof node.b === "string") {
      return (
        <span key={`${keyPrefix}b${i}`} className="font-medium">
          {node.b}
        </span>
      );
    }
    if (typeof node.i === "string") {
      return <em key={`${keyPrefix}i${i}`}>{node.i}</em>;
    }
    // The href was already scheme-checked in lib/markdown.js (safeHref), so
    // anything arriving here is http(s), mailto or site-relative. The rel is
    // unconditional rather than external-only: it costs nothing on an internal
    // link and can't be forgotten when the allowlist grows.
    if (typeof node.href === "string" && typeof node.text === "string") {
      return (
        <a
          key={`${keyPrefix}a${i}`}
          href={node.href}
          className="accent-link"
          rel="noopener noreferrer"
        >
          {node.text}
        </a>
      );
    }
    return null;
  });
}

/** One block. `first` suppresses the top margin at the start of a run. */
function renderBlock(block, i, first) {
  if (!block || typeof block !== "object") return null;

  switch (block.type) {
    case "p":
      return (
        <p key={i} className={first ? undefined : "mt-4"}>
          {renderInline(block.text, `${i}-`)}
        </p>
      );

    // A sub-heading inside a section. Section headings (### and above in the
    // Markdown) are rendered by the page as h2, so this is always h3.
    case "h3":
      return (
        <h3
          key={i}
          className={first ? "text-[18px] font-medium" : "mt-8 text-[18px] font-medium"}
          style={{ color: "var(--ink-graphite-deep)" }}
        >
          {block.text}
        </h3>
      );

    case "ul":
      return (
        <ul
          key={i}
          className={
            first
              ? "list-disc pl-6 space-y-1.5"
              : "mt-3 list-disc pl-6 space-y-1.5"
          }
        >
          {(block.items || []).map((item, j) => (
            <li key={j}>{renderInline(item, `${i}-${j}-`)}</li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol
          key={i}
          className={
            first
              ? "list-decimal pl-6 space-y-1.5"
              : "mt-3 list-decimal pl-6 space-y-1.5"
          }
        >
          {(block.items || []).map((item, j) => (
            <li key={j}>{renderInline(item, `${i}-${j}-`)}</li>
          ))}
        </ol>
      );

    case "callout":
      // Callout brings its own my-6, so it ignores the first-child rule. Its
      // children are blocks, so a callout can hold more than one paragraph.
      return (
        <Callout key={i} title={block.title}>
          <ArticleBody content={block.content} />
        </Callout>
      );

    case "table":
      // Cells are inline content, so a cell can carry a bold run even though
      // none currently does. Head labels stay plain strings.
      return (
        <Table
          key={i}
          head={block.head || []}
          rows={(block.rows || []).map((row, r) =>
            (row || []).map((cell, c) => renderInline(cell, `${i}-${r}-${c}-`)),
          )}
          caption={block.caption}
        />
      );

    case "figure": {
      // Figure brings its own my-6, so it ignores the first-child rule, like
      // Callout and Table. A path that cannot resolve renders nothing, which is
      // the same whitelist rule as every other node here.
      const src = blogImageUrl(block.path);
      if (!src) return null;
      return (
        <Figure
          key={i}
          src={src}
          alt={block.alt}
          width={block.w}
          height={block.h}
          caption={block.caption}
        />
      );
    }

    default:
      return null;
  }
}

export function ArticleBody({ content }) {
  if (!Array.isArray(content)) return null;
  return <>{content.map((block, i) => renderBlock(block, i, i === 0))}</>;
}
