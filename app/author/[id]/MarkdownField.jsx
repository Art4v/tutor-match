"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";

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

export function MarkdownField({ value, onChange, rows = 24 }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);

  function applyEdit(fn) {
    const ta = ref.current;
    if (!ta) return;
    const edit = fn({ value: ta.value, start: ta.selectionStart, end: ta.selectionEnd });
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

  /** Insert a block at the start of a fresh line. */
  function insertBlock(block) {
    applyEdit(({ value: v, start, end }) => {
      const atLineStart = start === 0 || v[start - 1] === "\n";
      const lead = atLineStart ? "" : "\n\n";
      const text = `${lead}${block}`;
      return {
        from: start,
        to: end,
        text,
        selStart: start + text.length,
        selEnd: start + text.length,
      };
    });
  }

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
    </div>
  );
}

function Btn({ label, onClick, icon, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Keeps the textarea selection alive through the click, which is the whole
      // reason every toolbar button in this repo does this.
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
      }}
    >
      {icon ? <Icon name={icon} size={15} /> : children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1" style={{ width: 1, height: 16, background: "var(--paper-line)" }} />;
}
