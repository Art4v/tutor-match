import { Fragment } from "react";

/**
 * Renders the tiny markdown subset produced by the settings About toolbar
 * (see lib/richText.js for the contract). No hooks / no "use client" so it
 * works in both the server profile page and client components.
 */

// Split a single line into React nodes, honouring **bold** and *italic*.
function renderInline(text, keyPrefix = "") {
  const str = String(text ?? "");
  const nodes = [];
  const regex = /(\*\*([^*]+?)\*\*|\*([^*]+?)\*)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = regex.exec(str)) !== null) {
    if (m.index > last) nodes.push(str.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}b${i}`} className="font-semibold text-slate-900">{m[2]}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}i${i}`}>{m[3]}</em>);
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < str.length) nodes.push(str.slice(last));
  return nodes;
}

/** Inline-only rendering (bold/italic), for the one-line tagline. */
export function InlineMarkdown({ text }) {
  return <>{renderInline(text)}</>;
}

/**
 * Parse the markdown subset into blocks: paragraphs (blank-line separated,
 * single newlines → <br/>), "- " bulleted lists, and "1. " numbered lists.
 * Exposed so callers (e.g. a cascading reveal) can render blocks one at a time.
 */
export function parseRichTextBlocks(text) {
  const lines = String(text ?? "").split("\n");
  const blocks = [];
  let para = [];
  let listType = null; // "ul" | "ol"
  let listItems = [];

  const flushPara = () => {
    if (para.length) { blocks.push({ type: "p", lines: para }); para = []; }
  };
  const flushList = () => {
    if (listItems.length) { blocks.push({ type: listType, items: listItems }); }
    listItems = [];
    listType = null;
  };

  for (const raw of lines) {
    const bullet = raw.match(/^\s*[-*]\s+(.*)$/);
    const numbered = raw.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(bullet[1]);
    } else if (numbered) {
      flushPara();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(numbered[1]);
    } else if (raw.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(raw);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

/**
 * Render a single block (no outer margin — the caller owns block spacing,
 * e.g. RichText's wrapper or a per-block reveal wrapper).
 */
export function RichTextBlock({ block, idx = 0 }) {
  if (block.type === "p") {
    return (
      <p>
        {block.lines.map((ln, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(ln, `${idx}-${j}-`)}
          </Fragment>
        ))}
      </p>
    );
  }
  const ListTag = block.type === "ol" ? "ol" : "ul";
  return (
    <ListTag className={(block.type === "ol" ? "list-decimal" : "list-disc") + " pl-5 space-y-1"}>
      {block.items.map((it, j) => (
        <li key={j}>{renderInline(it, `${idx}-${j}-`)}</li>
      ))}
    </ListTag>
  );
}

/**
 * Block rendering: paragraphs (blank-line separated, single newlines → <br/>),
 * "- " bulleted lists, and "1. " numbered lists, with inline bold/italic inside.
 */
export function RichText({ text, className = "" }) {
  const blocks = parseRichTextBlocks(text);
  return (
    <div className={className}>
      {blocks.map((b, idx) => (
        <div key={idx} className="mb-3 last:mb-0">
          <RichTextBlock block={b} idx={idx} />
        </div>
      ))}
    </div>
  );
}
