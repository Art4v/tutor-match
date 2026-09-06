"use client";

import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { TOOLTIP_STYLE } from "@/components/ui";
import { articleImages } from "@/lib/markdown";

// Preselected by the Caption button so the next keystroke replaces it, the same
// trick wrap2 uses for a link's URL.
const CAPTION_PLACEHOLDER = "Caption text.";

// ============================================================================
// The Markdown body field: a plain textarea plus a toolbar that inserts syntax.
//
// The edit mechanism is lifted from RichTextField (components/profile-edit/
// sections.js) and is worth keeping intact. Every toolbar action goes through
// applyEdit, which uses document.execCommand("insertText") rather than setting
// state directly, for two reasons spelled out there: it only touches the
// targeted range, so it cannot drop the rest of the field if React's value lags
// the DOM, and it joins the browser's NATIVE UNDO STACK, so Ctrl+Z reverts a
// toolbar insert exactly like typing. Replacing this with a setState would
// quietly break undo, which authors notice immediately in a long document.
// ============================================================================

export function MarkdownField({ value, onChange, rows = 24, onUploadImage }) {
  const ref = useRef(null);
  const fileRef = useRef(null);
  // Where the caret was when the picker opened. The file dialog takes focus and
  // the author may click elsewhere while the upload runs, so the insert point
  // is snapshotted rather than read back afterwards.
  const caretRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [uploading, setUploading] = useState(false);

  function applyEdit(fn, at) {
    const ta = ref.current;
    if (!ta) return;
    // Focus BEFORE execCommand. Every synchronous toolbar button already has
    // focus (Btn's onMouseDown preventDefault keeps it), so this is a no-op for
    // them, but the image insert runs after a file picker has stolen focus, and
    // execCommand("insertText") on an unfocused textarea returns false and
    // drops to the fallback below, costing the undo entry this whole mechanism
    // exists to protect.
    ta.focus();
    // `at` is a caret snapshot taken before an async detour, clamped because the
    // author may have typed or deleted while the upload was in flight.
    const start = at ? Math.min(at.start, ta.value.length) : ta.selectionStart;
    const end = at ? Math.min(at.end, ta.value.length) : ta.selectionEnd;
    const edit = fn({ value: ta.value, start, end });
    if (!edit) return;
    const { from, to, text, selStart, selEnd } = edit;

    ta.setSelectionRange(from, to);
    const ok = document.execCommand && document.execCommand("insertText", false, text);
    if (!ok) {
      // Fallback for browsers without execCommand. Correct, but it costs undo.
      onChange(ta.value.slice(0, from) + text + ta.value.slice(to));
    }
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(selStart, selEnd);
    });
  }

  /** Wrap the selection in a marker, or toggle it off if already wrapped. */
  function wrap(marker) {
    applyEdit(({ value: v, start, end }) => {
      const sel = v.slice(start, end);
      const n = marker.length;
      const already = v.slice(start - n, start) === marker && v.slice(end, end + n) === marker;

      if (already) {
        return {
          from: start - n,
          to: end + n,
          text: sel,
          selStart: start - n,
          selEnd: start - n + sel.length,
        };
      }
      const text = `${marker}${sel}${marker}`;
      return {
        from: start,
        to: end,
        text,
        // No selection: park the caret between the markers so typing continues.
        selStart: sel ? start + n : start + n,
        selEnd: sel ? start + n + sel.length : start + n,
      };
    });
  }

  /** Wrap with distinct open/close markers, for links. */
  function wrap2(open, close) {
    applyEdit(({ value: v, start, end }) => {
      const sel = v.slice(start, end);
      const text = `${open}${sel}${close}`;
      return {
        from: start,
        to: end,
        // Select the URL placeholder so the next keystroke replaces it.
        selStart: start + open.length + sel.length + 2,
        selEnd: start + text.length - 1,
        text,
      };
    });
  }

  /** Prefix every selected line, e.g. "## ", "- ", "1. ". */
  function prefixLines(makePrefix) {
    applyEdit(({ value: v, start, end }) => {
      const from = v.lastIndexOf("\n", start - 1) + 1;
      const nl = v.indexOf("\n", end);
      const to = nl === -1 ? v.length : nl;
      const lines = v.slice(from, to).split("\n");
      const text = lines.map((ln, i) => `${makePrefix(i)}${ln}`).join("\n");
      return { from, to, text, selStart: from, selEnd: from + text.length };
    });
  }

  /**
   * Insert a block at the start of a fresh line, leaving the caret
   * `caretOffset` characters into the inserted block. `at` is an optional caret
   * snapshot, for an insert that happens after an async detour.
   */
  function insertBlockAt(block, caretOffset, at) {
    applyEdit(({ value: v, start, end }) => {
      const atLineStart = start === 0 || v[start - 1] === "\n";
      const lead = atLineStart ? "" : "\n\n";
      const text = `${lead}${block}`;
      const caret = start + lead.length + (caretOffset ?? block.length);
      return { from: start, to: end, text, selStart: caret, selEnd: caret };
    }, at);
  }

  /** Insert a block at the start of a fresh line, caret after it. */
  function insertBlock(block) {
    insertBlockAt(block, block.length);
  }

  /**
   * Insert a standalone PARAGRAPH, guaranteeing a BLANK line before it, and
   * optionally selecting `selectLen` characters from `caretOffset`.
   *
   * The blank line is the whole point, and it is why this cannot just call
   * insertBlock. insertBlock guarantees a fresh LINE, but attachCaptions
   * (lib/markdown.js) only folds in a paragraph that is ENTIRELY italic, and an
   * italic line separated by a single newline is a softbreak run inside the
   * PRECEDING paragraph, i.e. [" ", { i: "..." }], two nodes rather than one.
   * A caption inserted one line under an image would therefore silently render
   * as ordinary body text. The caret sits on a fresh line right after an image
   * insert, so that is the common case, not the edge case.
   */
  function insertParagraph(block, caretOffset, selectLen = 0) {
    applyEdit(({ value: v, start, end }) => {
      // Already after a blank line: nothing to add. On a fresh line: one more
      // newline makes it blank. Mid-line: close the line and add a blank one.
      let lead = "\n\n";
      if (start === 0 || v.slice(start - 2, start) === "\n\n") lead = "";
      else if (v[start - 1] === "\n") lead = "\n";

      const text = `${lead}${block}`;
      const from = start + lead.length + caretOffset;
      return { from: start, to: end, text, selStart: from, selEnd: from + selectLen };
    });
  }

  function pickImage() {
    const ta = ref.current;
    if (ta) caretRef.current = { start: ta.selectionStart, end: ta.selectionEnd };
    fileRef.current?.click();
  }

  async function onPickImage(file) {
    if (!file || !onUploadImage) return;
    setUploading(true);
    const res = await onUploadImage(file);
    setUploading(false);
    if (!res?.ok) return; // the parent owns the error banner
    // Caret lands between "![" and "]", so typing alt text is the next
    // keystroke. Nothing is inserted before the upload resolves: the button's
    // own busy state is the acknowledgement, so there is no placeholder token
    // to find and replace, and no way to strand one if the upload fails.
    //
    // The caption placeholder matches the Table button's, and the BLANK LINE
    // before it is load-bearing: attachCaptions only folds in a paragraph that
    // is entirely italic, and without the blank line the italics would be a
    // softbreak run inside the image's own paragraph instead.
    insertBlockAt(
      `![](${res.path})\n\n*Optional caption in italics.*\n`,
      2,
      caretRef.current,
    );
    caretRef.current = null;
  }

  // Body images with no alt text. A soft nudge, never a gate: it is rendered
  // under the textarea because this component owns the markdown string and it
  // is where the author is looking. Uses the parser's own articleImages so
  // "what counts as a body image" has exactly one definition.
  const blankAlts = useMemo(
    () => articleImages(value || "").filter((img) => !img.alt).length,
    [value],
  );

  return (
    <div
      style={{
        border: `1px solid ${focused ? "var(--accent)" : "var(--paper-line)"}`,
        borderRadius: "var(--radius-card)",
        transition: "border-color 150ms ease-out",
        overflow: "hidden",
      }}
    >
      <div
        className="flex items-center gap-0.5 flex-wrap px-2 py-1.5"
        style={{ borderBottom: "1px solid var(--paper-line)", background: "var(--desk)" }}
      >
        <Btn label="Section heading" onClick={() => prefixLines(() => "## ")}>
          H2
        </Btn>
        <Btn label="Sub-heading" onClick={() => prefixLines(() => "### ")}>
          H3
        </Btn>
        <Divider />
        <Btn label="Bold" onClick={() => wrap("**")} icon="bold" />
        <Btn label="Italic" onClick={() => wrap("*")} icon="italic" />
        <Btn label="Link" onClick={() => wrap2("[", "](https://)")} icon="external" />
        <Divider />
        <Btn label="Bulleted list" onClick={() => prefixLines(() => "- ")} icon="list" />
        <Btn
          label="Numbered list"
          onClick={() => prefixLines((i) => `${i + 1}. `)}
          icon="list-ordered"
        />
        <Divider />
        <Btn
          label="Callout"
          onClick={() => insertBlock(":::callout Title\nText goes here.\n:::\n")}
          icon="info"
        />
        <Btn
          label="Table"
          onClick={() =>
            insertBlock(
              "| Column | Column |\n| --- | --- |\n| Cell | Cell |\n\n*Optional caption in italics.*\n",
            )
          }
          icon="grip"
        />
        {onUploadImage && (
          <>
            <Btn label="Image" onClick={pickImage} disabled={uploading} icon={uploading ? null : "image"}>
              {uploading ? "Uploading…" : null}
            </Btn>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                // Snapshot before clearing: e.target.files is a LIVE FileList.
                // Clearing lets the same file be re-picked after a failure.
                const f = e.target.files?.[0];
                e.target.value = "";
                onPickImage(f);
              }}
            />
          </>
        )}
        {/* Outside the onUploadImage guard: a caption belongs to a table just
            as much as to a figure, so it is available either way. */}
        <Btn
          label="Caption"
          onClick={() =>
            insertParagraph(`*${CAPTION_PLACEHOLDER}*\n`, 1, CAPTION_PLACEHOLDER.length)
          }
          icon="caption"
        />
      </div>

      <textarea
        ref={ref}
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        spellCheck
        placeholder={"## Your first section\n\nWrite the article here."}
        className="w-full px-4 py-3 outline-none resize-y font-mono"
        style={{
          background: "var(--paper-card)",
          color: "var(--ink)",
          fontSize: 13.5,
          lineHeight: 1.7,
        }}
      />

      {blankAlts > 0 && (
        <div
          className="px-4 py-2 text-[12.5px]"
          style={{
            borderTop: "1px solid var(--paper-line)",
            background: "var(--desk)",
            color: "var(--sage)",
          }}
        >
          {blankAlts === 1 ? "1 image has no alt text." : `${blankAlts} images have no alt text.`}{" "}
          Describe each one for screen readers and search. You can publish without it.
        </div>
      )}
    </div>
  );
}

// Most of this toolbar is icon-only, so each button names itself on hover. The
// native `title` attribute is deliberately GONE: it takes about a second to
// appear and cannot be themed, and leaving it alongside this would stack a
// second, slower label behind the first. aria-label still carries the name, so
// nothing changes for a screen reader.
//
// Two positioning constraints, both from the field wrapper's overflow: hidden.
// The label opens DOWNWARD, over the textarea, because above the toolbar it
// would be clipped. And it anchors left rather than centring, because the first
// button's label ("Section heading") is far wider than its 28px box and would
// clip against the left edge if centred; the toolbar only has px-2 of padding.
function Btn({ label, onClick, icon, children, disabled = false }) {
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        // Keeps the textarea selection alive through the click, which is the
        // whole reason every toolbar button in this repo does this. It stays on
        // the button, not the wrapper, so the wrapper cannot swallow it.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className="inline-flex items-center justify-center rounded"
        style={{
          minWidth: 28,
          height: 28,
          padding: "0 6px",
          color: "var(--ink-muted)",
          fontSize: 12,
          fontWeight: 500,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "default" : undefined,
        }}
      >
        {icon ? <Icon name={icon} size={15} /> : children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-0 mt-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-75 z-20"
        style={TOOLTIP_STYLE}
      >
        {label}
      </span>
    </span>
  );
}

function Divider() {
  return <span className="mx-1" style={{ width: 1, height: 16, background: "var(--paper-line)" }} />;
}
