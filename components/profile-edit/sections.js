"use client";

import { useEffect, useRef, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";
import { Avatar, Chip, Button } from "@/components/ui";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import { SubjectPicker } from "@/components/SubjectPicker";
import { SchoolCombobox } from "@/components/SchoolCombobox";
import { subjectLabel } from "@/lib/subjects";
import { completionScore } from "@/lib/ranking";
import { YEAR_MIN, YEAR_MAX, YEAR_LEVELS, yearLabel, yearRangeLabel } from "@/lib/yearLevels";
import { AVAILABILITY_DAYS, AVAILABILITY_HOURS, buildEmptyGrid, gridToBlocks, blocksToGrid, hourLabel } from "@/lib/availability";
import { uploadProfileImage } from "@/lib/supabase/storage";
import { ImageCropModal } from "@/components/ImageCropModal";

const ServiceMapLeaflet = dynamic(() => import("@/components/ServiceMapLeaflet"), { ssr: false });
// Full emoji picker (search + categories + skin tones). Client-only & lazy so it
// doesn't weigh down the settings bundle until a tutor opens the picker.
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

/* ============================================================
   Tutor settings sections — ported from the claude.ai/design
   bundle (62iWgxnY32ZnT0_dN7rKWQ). The visual language matches
   /tutor/[id]/page.js. The state shape mirrors lib/data.js.
   ============================================================ */


export const LANGUAGE_SUGGESTIONS = [
  "English", "Hindi", "Mandarin", "Vietnamese", "Japanese", "Tamil",
  "Cantonese", "Korean", "Punjabi", "Urdu", "Bengali", "Nepali",
  "Telugu", "Malayalam", "Kannada", "Gujarati", "Marathi", "Sinhala",
  "Arabic", "Spanish", "French", "German", "Italian", "Greek",
  "Portuguese", "Russian", "Indonesian", "Thai", "Filipino (Tagalog)",
  "Turkish", "Persian (Farsi)", "Malay", "Dutch", "Polish",
  "Auslan",
];

export const RESPONSE_OPTIONS = [
  "Usually responds in <1 hr",
  "Usually responds in <4 hrs",
  "Usually responds within a day",
  "Usually responds within 2 days",
];

// Canonical labels shared with the public profile (lib/availability.js) so the
// settings grid and the public AvailabilityGrid never drift apart.
export const DAYS = AVAILABILITY_DAYS;
export const HOUR_LABELS = AVAILABILITY_HOURS;

export function buildInitialAvailability() {
  return buildEmptyGrid();
}

/* ============================================================
   Form primitives
   ============================================================ */

// Shared field chrome (DESIGN.md §6 "Inputs"): label above in 14px/600, hint
// below in 12px muted, an error line in --error. Inputs are 44px, white, a 1px
// --border-input border and a 4px radius; focus is the --accent border plus the
// 2px accent outline (drawn on the wrapper so a prefix/suffix sits inside it).
export const FIELD_BOX =
  "flex items-stretch bg-surface border border-input rounded focus-within:border-accent " +
  "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent";
const BOX_TRANSITION = { transition: "border-color 120ms ease-out" };

export function Field({ label, hint, error, children, optional, full = true, as: Tag = "label" }) {
  return (
    <Tag className={"block " + (full ? "w-full" : "")}>
      {label && (
        <span className="mb-2 flex items-baseline gap-2 text-[14px] leading-5 font-semibold text-[color:var(--text)]">
          <span>{label}</span>
          {optional && <span className="text-[12px] leading-4 font-normal text-muted">Optional</span>}
        </span>
      )}
      {children}
      {(hint || error) && (
        <span className={"mt-2 block text-[12px] leading-4 " + (error ? "text-error" : "text-muted")}>{error || hint}</span>
      )}
    </Tag>
  );
}

export function TextInput({ value, onChange, placeholder, type = "text", inputMode, prefix, suffix, multiline, rows = 4, maxLength, onBlur, ariaLabel }) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <div className={FIELD_BOX + (multiline ? "" : " h-11")} style={BOX_TRANSITION}>
      {prefix && <span className="flex items-center pl-3 pr-1 text-[14px] leading-5 text-[color:var(--text-2)] tabular-nums">{prefix}</span>}
      <Tag
        type={multiline ? undefined : type}
        inputMode={inputMode}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onBlur?.()}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={multiline ? rows : undefined}
        maxLength={maxLength}
        className={
          "w-full min-w-0 bg-transparent text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder focus-visible:outline-none " +
          (multiline ? "py-3" : "")
        }
        style={{
          // Longhands only, never `padding` plus an `undefined` longhand: a
          // client-rendered mount (e.g. a portal modal) writes undefined as ""
          // and wipes that side of the shorthand, leaving text flush.
          paddingLeft: prefix ? 4 : 12,
          paddingRight: suffix ? 4 : 12,
          resize: multiline ? "vertical" : "none",
          fontFamily: "inherit",
        }}
      />
      {suffix && <span className="flex items-center whitespace-nowrap pl-1 pr-3 text-[14px] leading-5 text-[color:var(--text-2)] tabular-nums">{suffix}</span>}
    </div>
  );
}

/**
 * Textarea with a formatting toolbar (emoji / bold / italic, plus optional
 * bulleted + numbered lists). Writes the tiny markdown subset documented in
 * lib/richText.js; the public profile renders it via <RichText>.
 */
export function RichTextField({ value, onChange, placeholder, rows = 4, maxLength, lists = false, ai }) {
  const taRef = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close the emoji popover on outside click.
  useEffect(() => {
    if (!emojiOpen) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setEmojiOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [emojiOpen]);

  // Apply an edit by replacing the range [from, to) with `text`, then selecting
  // [selStart, selEnd]. We use document.execCommand("insertText") rather than
  // rewriting the whole value through React, because that:
  //   (a) only touches the targeted range — it can never drop the rest of the
  //       field (the old whole-value replacement could, if React's `value` prop
  //       lagged the DOM after typing), and
  //   (b) joins the browser's native undo stack, so Ctrl+Z reverts a bold/italic
  //       just like it reverts typing.
  // The transform reads the live textarea value + selection (always mutually
  // consistent) and returns the range + replacement text + final selection.
  const applyEdit = (fn) => {
    const ta = taRef.current;
    if (!ta) return;
    const res = fn({ value: ta.value, start: ta.selectionStart, end: ta.selectionEnd });
    if (!res) return;
    const { from, to, text, selStart, selEnd } = res;
    if (maxLength && ta.value.length - (to - from) + text.length > maxLength) return; // would overflow — no-op
    ta.focus();
    ta.setSelectionRange(from, to);
    // insertText replaces the selection in place and fires a native `input`
    // event, which our textarea onChange picks up to sync React state.
    const ok = typeof document !== "undefined" && document.execCommand
      && document.execCommand("insertText", false, text);
    if (!ok) {
      // Fallback (rare — execCommand unsupported): controlled replacement.
      // Correct text, but no native undo.
      onChange(ta.value.slice(0, from) + text + ta.value.slice(to));
    }
    requestAnimationFrame(() => {
      const node = taRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(selStart, selEnd);
    });
  };

  // Wrap the selection in `marker` (toggling off if already wrapped). With no
  // selection, drop the markers and place the caret between them.
  const wrap = (marker) => applyEdit(({ value, start, end }) => {
    const sel = value.slice(start, end);
    const len = marker.length;
    if (sel) {
      if (sel.startsWith(marker) && sel.endsWith(marker) && sel.length >= len * 2) {
        const inner = sel.slice(len, sel.length - len);
        return { from: start, to: end, text: inner, selStart: start, selEnd: start + inner.length };
      }
      return { from: start, to: end, text: marker + sel + marker, selStart: start + len, selEnd: end + len };
    }
    return { from: start, to: end, text: marker + marker, selStart: start + len, selEnd: start + len };
  });

  // Prefix each line of the selection with a list marker (toggling off if set).
  const toggleList = (kind) => applyEdit(({ value, start, end }) => {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = value.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = value.length;
    const lines = value.slice(lineStart, lineEnd).split("\n");
    const bulletRe = /^\s*[-*]\s+/;
    const numRe = /^\s*\d+\.\s+/;
    const ordered = kind === "ol";
    const allMarked = lines.every((l) => (ordered ? numRe : bulletRe).test(l));
    const bare = (l) => l.replace(bulletRe, "").replace(numRe, "");
    const out = allMarked
      ? lines.map(bare)
      : lines.map((l, i) => (ordered ? `${i + 1}. ` : "- ") + bare(l));
    const block = out.join("\n");
    return { from: lineStart, to: lineEnd, text: block, selStart: lineStart, selEnd: lineStart + block.length };
  });

  const insert = (text) => applyEdit(({ start, end }) => (
    { from: start, to: end, text, selStart: start + text.length, selEnd: start + text.length }
  ));

  // ── AI generation (preview-then-accept) ───────────────────────────────────
  // Active only when an `ai` config is passed (the About section's tagline +
  // long-bio fields). genState: idle | loading | preview | error.
  const [genState, setGenState] = useState("idle");
  const [preview, setPreview] = useState("");
  const [genError, setGenError] = useState("");

  const runGenerate = async () => {
    if (genState === "loading" || !ai) return;
    setGenState("loading");
    setGenError("");
    try {
      const text = await ai.onGenerate();
      setPreview(maxLength ? String(text).slice(0, maxLength) : String(text));
      setGenState("preview");
    } catch (e) {
      setGenError(e?.message || "Generation failed. Please try again.");
      setGenState("error");
    }
  };
  const acceptPreview = () => {
    // Replace the whole field via execCommand so Ctrl+Z still restores the
    // previous text (preview is pre-clamped to maxLength, so the guard passes).
    applyEdit(({ value: v }) => ({ from: 0, to: v.length, text: preview, selStart: preview.length, selEnd: preview.length }));
    setGenState("idle");
    setPreview("");
  };
  const dismissPreview = () => { setGenState("idle"); setPreview(""); setGenError(""); };

  const ToolbarBtn = ({ icon, label, onClick, active }) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      onMouseDown={(e) => e.preventDefault()} // keep textarea selection
      onClick={onClick}
      className={
        "inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2 hover:text-[color:var(--text)] " +
        (active ? "bg-surface-2 text-[color:var(--text)]" : "")
      }
      style={{ transition: "background-color 120ms ease-out, color 120ms ease-out" }}
    >
      <Icon name={icon} size={16} />
    </button>
  );

  return (
    <div
      ref={wrapRef}
      className="relative bg-surface border border-input rounded focus-within:border-accent has-[textarea:focus]:outline has-[textarea:focus]:outline-2 has-[textarea:focus]:outline-offset-2 has-[textarea:focus]:outline-accent"
      style={BOX_TRANSITION}
    >
      <div className="flex flex-wrap items-center border-b border-rule px-1">
        <div className="relative">
          <ToolbarBtn icon="smile" label="Insert emoji" active={emojiOpen} onClick={() => setEmojiOpen((o) => !o)} />
          {emojiOpen && (
            <div
              className="absolute left-0 top-12 z-30 overflow-hidden rounded border border-rule"
              style={{ boxShadow: "var(--shadow-float)" }}
            >
              <EmojiPicker
                onEmojiClick={(data) => { insert(data.emoji); setEmojiOpen(false); }}
                emojiStyle="native"
                lazyLoadEmojis
                width={320}
                height={380}
                previewConfig={{ showPreview: false }}
                skinTonesDisabled
                searchPlaceHolder="Search emoji"
              />
            </div>
          )}
        </div>
        <ToolbarBtn icon="bold" label="Bold" onClick={() => wrap("**")} />
        <ToolbarBtn icon="italic" label="Italic" onClick={() => wrap("*")} />
        {lists && (
          <>
            <ToolbarBtn icon="list" label="Bulleted list" onClick={() => toggleList("ul")} />
            <ToolbarBtn icon="list-ordered" label="Numbered list" onClick={() => toggleList("ol")} />
          </>
        )}
        {ai && (
          <div className="ml-auto flex items-center gap-2">
            {ai.usage && typeof ai.usage.remaining === "number" && (
              <span className="text-[12px] leading-4 text-muted tabular-nums whitespace-nowrap">
                {ai.usage.remaining}/{ai.usage.limit} left
                {ai.usage.resetsAt && (
                  <span className="hidden sm:inline">
                    {", resets "}
                    {new Date(ai.usage.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
              </span>
            )}
            {/* A text button (DESIGN.md: no icon inside a labelled button). The
                accessible name starts with the visible words. */}
            <button
              type="button"
              aria-label={ai.label || "Write with AI"}
              onMouseDown={(e) => e.preventDefault()} // keep textarea selection
              onClick={runGenerate}
              disabled={genState === "loading" || ai.usage?.remaining === 0}
              className="inline-flex h-11 items-center rounded px-3 text-[14px] leading-5 font-semibold text-accent hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ transition: "background-color 120ms ease-out" }}
            >
              {genState === "loading" ? "Writing…" : "Write with AI"}
            </button>
          </div>
        )}
      </div>
      <textarea
        ref={taRef}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="block w-full bg-transparent px-3 py-3 text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder focus-visible:outline-none"
        style={{ resize: "vertical", fontFamily: "inherit" }}
      />
      {ai && genState !== "idle" && (
        <div className="border-t border-rule px-3 py-3">
          {genState === "loading" && (
            <p className="text-[14px] leading-5 text-[color:var(--text-2)]">Writing…</p>
          )}
          {genState === "error" && (
            <div>
              <p className="text-[14px] leading-5 text-error">{genError}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={runGenerate}>Try again</Button>
                <Button variant="ghost" onClick={dismissPreview}>Dismiss</Button>
              </div>
            </div>
          )}
          {genState === "preview" && (
            <div>
              <p className="mb-2 text-[12px] leading-4 text-muted">AI draft (preview)</p>
              <div className="whitespace-pre-wrap rounded bg-surface-2 px-3 py-2 text-[14px] leading-5 text-[color:var(--text)]">
                {preview}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={acceptPreview}>Accept</Button>
                <Button variant="outline" onClick={runGenerate}>Regenerate</Button>
                <Button variant="ghost" onClick={dismissPreview}>Dismiss</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Select({ value, onChange, options, ariaLabel }) {
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="h-11 w-full appearance-none rounded border border-input bg-surface pl-3 pr-12 text-[14px] leading-5 text-[color:var(--text)] focus:border-accent"
        style={{ fontFamily: "inherit", ...BOX_TRANSITION }}
      >
        {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-2)]">
        <Icon name="chevron-down" size={16} />
      </span>
    </div>
  );
}

// A checkbox row (the old pill switch is gone: DESIGN.md allows no pills). Same
// API: `value` is the boolean, `onChange(next)` flips it. The whole row is the
// label, at least 44px tall.
export function Toggle({ value, onChange, label, hint }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
      <span className="flex h-5 shrink-0 items-center">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 cursor-pointer"
          style={{ accentColor: "var(--accent)" }}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] leading-5 font-semibold text-[color:var(--text)]">{label}</span>
        {hint && <span className="mt-1 block text-[12px] leading-4 text-muted">{hint}</span>}
      </span>
    </label>
  );
}

// Non-bare sections (the onboarding steps) render as flat sections divided by
// rules, not cards (DESIGN.md §4: prefer no box). `padding` / `className` are
// accepted for the old call shape.
function Card({ children, className = "" }) {
  return <section className={"border-b border-rule py-6 first:pt-0 last:border-b-0 " + className}>{children}</section>;
}

// `hideTitle`: inside an editor modal whose own title already names the
// section, so only the subtitle and the action remain.
export function SectionHeader({ title, subtitle, right, hideTitle = false }) {
  if (hideTitle && !subtitle && !right) return null;
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {!hideTitle && <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">{title}</h2>}
        {subtitle && <p className={(hideTitle ? "" : "mt-1 ") + "text-[14px] leading-5 text-[color:var(--text-2)]"}>{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}

function MetaLabel({ children }) {
  return <div className="text-[14px] leading-5 font-semibold text-[color:var(--text)]">{children}</div>;
}

function move(arr, from, to) {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// One row of a reorderable list (credentials, packages, experience,
// education): the fields, then Move up / Move down / Remove as 44px icon
// buttons. Rows are divided by rules.
function ReorderRow({ index, count, onMove, onRemove, children }) {
  const btn =
    "inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2 hover:text-[color:var(--text)] disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <div className={"flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:gap-4 " + (index === 0 ? "" : "border-t border-rule")}>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-center justify-end sm:pt-6">
        <button type="button" onClick={() => onMove(Math.max(0, index - 1))} disabled={index === 0} className={btn} aria-label="Move up" title="Move up" style={{ transition: "background-color 120ms ease-out" }}>
          <Icon name="chevron-up" size={16} />
        </button>
        <button type="button" onClick={() => onMove(Math.min(count - 1, index + 1))} disabled={index === count - 1} className={btn} aria-label="Move down" title="Move down" style={{ transition: "background-color 120ms ease-out" }}>
          <Icon name="chevron-down" size={16} />
        </button>
        <button type="button" onClick={onRemove} className={btn + " hover:text-error"} aria-label="Remove" title="Remove" style={{ transition: "background-color 120ms ease-out" }}>
          <Icon name="trash" size={16} />
        </button>
      </div>
    </div>
  );
}

function TagInput({ values, onChange, suggestions = [], placeholder = "Add" }) {
  const [draft, setDraft] = useState("");
  const [focus, setFocus] = useState(false);
  const ref = useRef(null);
  const add = (v) => {
    const t = (v || "").trim();
    if (!t || values.includes(t)) return;
    onChange([...values, t]);
    setDraft("");
  };
  const remaining = suggestions
    .filter((s) => !values.includes(s) && (!draft || s.toLowerCase().includes(draft.toLowerCase())))
    .slice(0, 6);
  return (
    <div>
      <div
        className={FIELD_BOX + " min-h-11 flex-wrap items-center gap-2 px-2 py-1 cursor-text"}
        onClick={() => ref.current?.focus()}
        style={BOX_TRANSITION}
      >
        {values.map((v) => (
          <Chip key={v} tone="grey" onRemove={() => onChange(values.filter((x) => x !== v))}>{v}</Chip>
        ))}
        <input
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
            else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
          }}
          placeholder={values.length === 0 ? placeholder : ""}
          className="h-8 min-w-[100px] flex-1 bg-transparent px-1 text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder focus-visible:outline-none"
        />
      </div>
      {focus && remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {remaining.map((s) => (
            <button
              type="button"
              key={s}
              onMouseDown={(e) => { e.preventDefault(); add(s); }}
              className="inline-flex h-11 items-center rounded border border-rule bg-surface px-3 text-[14px] leading-5 text-[color:var(--text)] hover:bg-surface-2"
              style={{ transition: "background-color 120ms ease-out" }}
            >
              Add {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Sections
   ============================================================ */

// `upload` / `resolve` let a caller store the image somewhere other than the
// public profile-images bucket: a verified tutor's draft uploads to private
// staging and stores a "staging:<path>" reference (0072), which `resolve` turns
// back into a previewable URL. Both default to the plain public upload, so
// every other caller (onboarding, company tutors) is unchanged.
export function ImageUploadControl({ label, value, kind, supabase, userId, onChange, hint, aspect, cropShape, maxOutputPx, upload, resolve }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);

  const onPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a remove
    if (!file) return;
    if (!supabase || !userId) { setErr("Sign in again to upload."); return; }
    if (!file.type?.startsWith("image/")) { setErr("Please choose an image file."); return; }
    setErr(null);
    setPendingFile(file);
  };

  const onCropConfirm = async (croppedFile) => {
    setPendingFile(null);
    setBusy(true);
    const res = upload
      ? await upload(croppedFile, kind)
      : await uploadProfileImage(supabase, userId, kind, croppedFile);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    onChange(res.url);
  };

  const isRound = (cropShape ?? "rect") === "round";
  const previewH = 56;
  const previewW = isRound ? previewH : Math.round(previewH * (aspect ?? 1));
  const shown = value ? (resolve ? resolve(value) : value) : null;

  return (
    <div>
      <MetaLabel>{label}</MetaLabel>
      <div className="mt-2 flex items-start gap-4">
        {/* People are circles, everything else 4px (DESIGN.md §4). An empty
            preview is the plain tint, no placeholder icon. */}
        <div
          className="shrink-0 overflow-hidden border border-rule bg-surface-2"
          style={{ width: previewW, height: previewH, borderRadius: isRound ? "50%" : "var(--radius)" }}
        >
          {shown && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt={`${label} preview`} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
            <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? "Uploading…" : value ? "Replace" : "Upload"}
            </Button>
            {value && !busy && (
              <Button variant="ghost" onClick={() => onChange(null)}>Remove</Button>
            )}
          </div>
          {err
            ? <p className="mt-2 text-[12px] leading-4 text-error">{err}</p>
            : hint && <p className="mt-2 text-[12px] leading-4 text-muted">{hint}</p>}
        </div>
      </div>
      <ImageCropModal
        open={!!pendingFile}
        file={pendingFile}
        aspect={aspect ?? 1}
        cropShape={cropShape ?? "rect"}
        maxOutputPx={maxOutputPx}
        title={`Crop ${label.toLowerCase()}`}
        onCancel={() => setPendingFile(null)}
        onConfirm={onCropConfirm}
      />
    </div>
  );
}

// Just the image portion of BannerAvatarSection: the photo + banner uploads.
// Split out so the onboarding wizard can surface image upload on step 1
// without dragging in the delivery toggles (which it asks separately).
// BannerAvatarSection composes this + delivery + response.
//
// The banner colour swatches are gone: the profile shows a banner only when
// one is uploaded (DESIGN.md §6 "Profile header") and avatars use no
// tutor-picked colours, so a picked colour had nowhere to show. The stored
// `bannerBg` field is untouched (it still round-trips through the save).
export function ProfileImagesSection({ tutor, set, supabase, bare = false, uploadImage, resolveImage }) {
  const body = (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <ImageUploadControl
        label="Profile photo"
        value={tutor.avatarImg}
        kind="avatar"
        supabase={supabase}
        userId={tutor.id}
        onChange={(url) => set({ avatarImg: url })}
        upload={uploadImage}
        resolve={resolveImage}
        hint="A clear photo of your face. Without one, your initials are shown."
        aspect={1}
        cropShape="round"
        maxOutputPx={1024}
      />
      <ImageUploadControl
        label="Banner image"
        value={tutor.bannerImg}
        kind="banner"
        supabase={supabase}
        userId={tutor.id}
        onChange={(url) => set({ bannerImg: url })}
        upload={uploadImage}
        resolve={resolveImage}
        hint="Optional. A wide image, about 1200 by 320 pixels. Without one, your profile has no banner."
        aspect={1200 / 320}
        cropShape="rect"
        maxOutputPx={2400}
      />
    </div>
  );
  if (bare) return body;
  return (
    <Card>
      <SectionHeader title="Profile images" subtitle="Your photo and banner at the top of your profile." />
      {body}
    </Card>
  );
}

export function BannerAvatarSection({ tutor, set, supabase, bare = false, uploadImage, resolveImage }) {
  const body = (
    <>
      <ProfileImagesSection tutor={tutor} set={set} supabase={supabase} bare uploadImage={uploadImage} resolveImage={resolveImage} />
      <div className="mt-6 border-t border-rule pt-6">
        <MetaLabel>How you teach</MetaLabel>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Toggle value={tutor.deliversInPerson} onChange={(v) => set({ deliversInPerson: v })} label="In person" hint="Inside the service area you set on your profile." />
          <Toggle value={tutor.deliversOnline} onChange={(v) => set({ deliversOnline: v })} label="Online" hint="Over a video call." />
        </div>
      </div>
      {/* Self-reported (REDESIGN_DECISIONS.md R13): the select and its
          "Usually responds in <1 hr" default stay as they are. */}
      <div className="mt-6">
        <Field label="Response time" hint="Shown on your profile as your own estimate.">
          <Select value={tutor.responsiveText} onChange={(v) => set({ responsiveText: v })} options={RESPONSE_OPTIONS} />
        </Field>
      </div>
    </>
  );
  if (bare) return body;
  return (
    <Card>
      <SectionHeader title="Banner and photo" subtitle="The banner, your photo and the details at the top of your profile." />
      {body}
    </Card>
  );
}

export function IdentitySection({ tutor, set, bare = false }) {
  const nameError = (tutor.name || "").trim() ? undefined : "Your full name is required.";
  const body = (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" hint="Use the name that matches your government ID." error={nameError}><TextInput value={tutor.name} onChange={(v) => set({ name: v, initial: (v || " ").charAt(0).toUpperCase() })} /></Field>
        <Field label="Years tutoring">
          <TextInput value={tutor.yearsTutoring || ""} onChange={(v) => set({ yearsTutoring: Number(v.replace(/\D/g, "")) || 0 })} suffix="years" inputMode="numeric" />
        </Field>
      </div>
      <div className="mt-6">
        <Field label="Languages spoken">
          <TagInput values={tutor.languages} onChange={(v) => set({ languages: v })} suggestions={LANGUAGE_SUGGESTIONS} placeholder="Add a language" />
        </Field>
      </div>
    </>
  );
  if (bare) return body;
  return (
    <Card>
      <SectionHeader title="About you" subtitle="Shown under your photo on your profile." />
      {body}
    </Card>
  );
}

const CREDENTIAL_TYPES = [
  { value: "atar",        label: "ATAR",       caption: "ATAR",       kind: "stat",       placeholder: "e.g. 98.05" },
  { value: "trophy",      label: "Award",      caption: "Award",      kind: "credential", placeholder: "e.g. Dux, 2021" },
  { value: "graduation",  label: "Degree",     caption: "Degree",     kind: "credential", placeholder: "e.g. Bachelor of Science" },
  { value: "check-badge", label: "State rank", caption: "State rank", kind: "credential", placeholder: "e.g. 1st in Chemistry, 2021" },
  { value: "star",        label: "Highlight",  caption: "Highlight",  kind: "credential", placeholder: "e.g. Top 1% nationally" },
];

function typeForIcon(icon) {
  return CREDENTIAL_TYPES.find((t) => t.value === icon) ?? { caption: "Credential", kind: "credential", placeholder: "" };
}

const EDUCATION_LEVELS = [
  { value: "high_school", label: "High school" },
  { value: "university",  label: "University" },
];

// Keep the ATAR label to 4 significant figures while typing — the ATAR format
// (max 99.95) is XX.XX: at most 2 integer digits and 2 decimal digits. Strip
// non-digits, collapse to a single dot, clamp both parts. The "exactly 2 dp"
// normalisation happens on blur (and again on save via toFixed).
function sanitizeAtarInput(v) {
  const s = String(v).replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot === -1) return s.slice(0, 2);
  const intPart = s.slice(0, dot).slice(0, 2);
  const decPart = s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return intPart + "." + decPart;
}

export function CredentialsSection({ tutor, set, bare = false, hideTitle = false }) {
  const Wrap = bare ? Fragment : Card;
  const list = tutor.credentials || [];
  const update = (i, p) => set({ credentials: list.map((c, idx) => idx === i ? { ...c, ...p } : c) });
  const remove = (i) => set({ credentials: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ credentials: move(list, i, to) });
  const add = () => set({ credentials: [...list, { label: "", icon: "trophy" }] });

  return (
    <Wrap>
      <SectionHeader hideTitle={hideTitle} title="Credentials" subtitle="Your achievements. The first one is featured in search results."
        right={<Button variant="outline" onClick={add}>Add credential</Button>} />
      {list.length === 0 && <p className="text-[14px] leading-5 text-[color:var(--text-2)]">No credentials yet. Add an ATAR, award, degree or state rank.</p>}
      <div>
        {list.map((c, i) => {
          const t = typeForIcon(c.icon);
          // Only one ATAR credential allowed (it doubles as the /browse filter
          // value) — hide the option once another row already holds it.
          const atarTaken = list.some((cc, idx) => idx !== i && cc.icon === "atar");
          const opts = CREDENTIAL_TYPES
            .filter((ct) => ct.value !== "atar" || !atarTaken)
            .map(({ value, label }) => ({ value, label }));
          // ATAR is numeric, 4 sig figs (XX.XX): sanitise while typing, then
          // force exactly 2 dp on blur (blank + non-numeric collapse to empty).
          const isAtar = c.icon === "atar";
          return (
            <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
                <Field label="Type">
                  <Select value={c.icon} onChange={(v) => update(i, { icon: v })} options={opts} />
                </Field>
                <Field label={isAtar ? "ATAR" : "Details"}>
                <TextInput
                  value={c.label}
                  onChange={(v) => update(i, { label: isAtar ? sanitizeAtarInput(v) : v })}
                  onBlur={isAtar ? () => {
                    const n = Number(c.label);
                    update(i, { label: c.label && Number.isFinite(n) ? n.toFixed(2) : "" });
                  } : undefined}
                  inputMode={isAtar ? "decimal" : undefined}
                  placeholder={t.placeholder}
                />
                </Field>
              </div>
            </ReorderRow>
          );
        })}
      </div>
    </Wrap>
  );
}

// Allowlisted profile fields sent to /api/ai/generate-bio as prompt context.
// The route re-sanitizes and resolves subject slugs to labels, so this is just
// "send what's relevant" — anything else is dropped server-side.
function aiProfileContext(t) {
  return {
    name: t.name,
    subjects: t.subjects,
    yearMin: t.yearMin,
    yearMax: t.yearMax,
    rate: t.rate,
    yearsTutoring: t.yearsTutoring,
    languages: t.languages,
    credentials: t.credentials,
    experience: t.experience,
    education: t.education,
    deliversInPerson: t.deliversInPerson,
    deliversOnline: t.deliversOnline,
    suburb: t.suburb || t.serviceArea?.suburb,
    bio: t.bio,
    bioLong: t.bioLong,
  };
}

export function AboutSection({ tutor, set, bare = false, hideTitle = false }) {
  const Wrap = bare ? Fragment : Card;
  const long = tutor.bioLong || "";
  const SOFT_LIMIT = 5000; // words
  const wordCount = long.trim() ? long.trim().split(/\s+/).length : 0;
  const over = wordCount > SOFT_LIMIT;

  // Shared daily-generation budget (taglines + bios draw from the same 10/day).
  const [usage, setUsage] = useState(null); // { used, limit, remaining, resetsAt }
  useEffect(() => {
    let active = true;
    fetch("/api/ai/generate-bio")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d && typeof d.limit === "number") setUsage(d); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Returns the generated text (RichTextField shows it as a preview). Throwing
  // surfaces the message in the field's preview panel.
  const generate = async (kind) => {
    const res = await fetch("/api/ai/generate-bio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, profile: aiProfileContext(tutor) }),
    });
    let data = {};
    try { data = await res.json(); } catch { /* non-JSON error body */ }
    // Both success and 429 echo the latest usage — keep the counter fresh.
    if (typeof data.limit === "number") {
      setUsage({ used: data.used, limit: data.limit, remaining: data.remaining, resetsAt: data.resetsAt });
    }
    if (!res.ok) throw new Error(data.error || "Generation failed. Please try again.");
    return data.text || "";
  };

  return (
    <Wrap>
      <SectionHeader hideTitle={hideTitle} title="About" subtitle="The story students read on your profile." />
      <Field as="div" label="Tagline" hint="One line, shown in search results and under your name.">
        <RichTextField rows={2} value={tutor.bio} onChange={(v) => set({ bio: v })} maxLength={180}
          ai={{ onGenerate: () => generate("tagline"), label: "Write with AI: tagline", usage }}
          placeholder="Patient, structured tutor who writes clear notes…" />
      </Field>
      <div className="mt-6">
        <Field as="div" label="About"
          error={over ? `${wordCount - SOFT_LIMIT} words over the limit. Consider trimming it.` : null}
          hint={!over ? `${wordCount} / ${SOFT_LIMIT} words` : null}>
          <RichTextField rows={8} value={long} onChange={(v) => set({ bioLong: v })} lists
            ai={{ onGenerate: () => generate("bio"), label: "Write with AI: bio", usage }}
            placeholder="Tell students about your teaching approach…" />
        </Field>
      </div>
    </Wrap>
  );
}

export function RateSection({ tutor, set, bare = false, hideTitle = false }) {
  const Wrap = bare ? Fragment : Card;
  const list = tutor.packages || [];
  const update = (i, p) => set({ packages: list.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const remove = (i) => set({ packages: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ packages: move(list, i, to) });
  const add = () => set({ packages: [...list, { label: "", price: tutor.rate || 0 }] });
  return (
    <Wrap>
      <SectionHeader hideTitle={hideTitle} title="Rate and packages" subtitle="Your hourly rate, and any lesson packages you offer."
        right={<Button variant="outline" onClick={add}>Add package</Button>} />
      <Field label="Hourly rate" hint="Leave empty to show Rate not listed.">
        <div className="max-w-[200px]">
          <TextInput value={tutor.rate || ""} onChange={(v) => set({ rate: Number(v.replace(/\D/g, "")) || 0 })} prefix="$" suffix="per hour" inputMode="numeric" />
        </div>
      </Field>
      {list.length > 0 && (
      <div className="mt-6">
        <MetaLabel>Packages</MetaLabel>
        <div className="mt-2">
          {list.map((p, i) => (
            <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
                <Field label="Package">
                  <TextInput value={p.label} onChange={(v) => update(i, { label: v })} placeholder="e.g. 5 lessons" />
                </Field>
                <Field label="Price">
                  <TextInput value={p.price} onChange={(v) => update(i, { price: Number(v.replace(/\D/g, "")) || 0 })} prefix="$" inputMode="numeric" />
                </Field>
              </div>
            </ReorderRow>
          ))}
        </div>
      </div>
      )}
    </Wrap>
  );
}

export function ExperienceSection({ tutor, set, bare = false, hideTitle = false }) {
  const Wrap = bare ? Fragment : Card;
  const list = tutor.experience || [];
  const update = (i, p) => set({ experience: list.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const remove = (i) => set({ experience: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ experience: move(list, i, to) });
  const add = () => set({ experience: [...list, { role: "", org: "", period: "", note: "" }] });
  return (
    <Wrap>
      <SectionHeader hideTitle={hideTitle} title="Experience" subtitle="Your tutoring and teaching roles."
        right={<Button variant="outline" onClick={add}>Add role</Button>} />
      {list.length === 0 && <p className="text-[14px] leading-5 text-[color:var(--text-2)]">No roles yet.</p>}
      <div>
        {list.map((e, i) => (
          <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Role"><TextInput value={e.role} onChange={(v) => update(i, { role: v })} placeholder="e.g. Private tutor" /></Field>
              <Field label="Organisation"><TextInput value={e.org} onChange={(v) => update(i, { org: v })} placeholder="e.g. Self-employed" /></Field>
              <Field label="Dates"><TextInput value={e.period} onChange={(v) => update(i, { period: v })} placeholder="e.g. 2022 to now" /></Field>
            </div>
            <div className="mt-4">
              <Field label="Description" optional><TextInput value={e.note} onChange={(v) => update(i, { note: v })} placeholder="One line about what you did" /></Field>
            </div>
          </ReorderRow>
        ))}
      </div>
    </Wrap>
  );
}

export function EducationSection({ tutor, set, schoolCatalog = [], bare = false, hideTitle = false }) {
  const Wrap = bare ? Fragment : Card;
  const list = tutor.education || [];
  const update = (i, p) => set({ education: list.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const remove = (i) => set({ education: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ education: move(list, i, to) });
  const add = () => set({ education: [...list, { school: "", detail: "", level: "high_school", schoolSlug: null }] });
  return (
    <Wrap>
      <SectionHeader hideTitle={hideTitle} title="Education" right={<Button variant="outline" onClick={add}>Add school</Button>} />
      {list.length === 0 && <p className="text-[14px] leading-5 text-[color:var(--text-2)]">No schools yet.</p>}
      <div>
        {list.map((e, i) => {
          const level = e.level ?? "high_school";
          return (
            <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
                {/* Switching away from high school clears any listed-school link. */}
                <Field label="Level">
                  <Select value={level} onChange={(v) => update(i, v === "high_school" ? { level: v } : { level: v, schoolSlug: null })} options={EDUCATION_LEVELS} />
                </Field>
                {/* as="div": the school combobox has its own listbox and
                    clear button, which must not sit inside a <label>. */}
                <Field as="div" label={level === "high_school" ? "School" : "University"}>
                {level === "high_school" ? (
                  <SchoolCombobox
                    value={e.school}
                    schoolSlug={e.schoolSlug ?? null}
                    catalog={schoolCatalog}
                    onChange={({ school, schoolSlug }) => update(i, { school, schoolSlug })}
                    placeholder="Start typing your school"
                  />
                ) : (
                  <TextInput value={e.school} onChange={(v) => update(i, { school: v })} ariaLabel="University" />
                )}
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Details" optional>
                  <TextInput value={e.detail} onChange={(v) => update(i, { detail: v })} placeholder={level === "high_school" ? "e.g. Year 7 to 12" : "e.g. Bachelor of Science, Year 2"} />
                </Field>
              </div>
            </ReorderRow>
          );
        })}
      </div>
    </Wrap>
  );
}

export function SubjectsSection({ tutor, set, catalog, bare = false, hideTitle = false }) {
  const Wrap = bare ? Fragment : Card;
  // The dropdown is absolutely positioned, so it can't grow the host modal on
  // its own. Reserve an in-flow spacer equal to the open panel's height so the
  // modal expands to fit it — and collapses back (no empty space) on close.
  const [reserve, setReserve] = useState(0);
  return (
    <Wrap>
      <SectionHeader hideTitle={hideTitle} title="Subjects" subtitle="Students find you by these. Pick an exam, then choose the subjects you tutor." />
      <SubjectPicker
        catalog={catalog}
        value={tutor.subjects}
        onChange={(slugs) => set({ subjects: slugs })}
        mode="multi"
        variant="box"
        placeholder="Add subjects"
        onOpenChange={(open, height) => setReserve(open ? height + 8 : 0)}
      />
      <div aria-hidden style={{ height: reserve }} />
    </Wrap>
  );
}

export function YearLevelsSection({ tutor, set, bare = false }) {
  // Single dual-handle slider. Clamp each handle against the other so the range
  // stays valid (min ≤ max) without one handle pushing the other.
  const min = Number.isFinite(tutor.yearMin) ? tutor.yearMin : 7;
  const max = Number.isFinite(tutor.yearMax) ? tutor.yearMax : 12;
  const setMin = (v) => set({ yearMin: Math.min(Number(v), max) });
  const setMax = (v) => set({ yearMax: Math.max(Number(v), min) });
  const span = (YEAR_MAX - YEAR_MIN) || 1;
  const minPct = ((min - YEAR_MIN) / span) * 100;
  const maxPct = ((max - YEAR_MIN) / span) * 100;
  const body = (
    <Field label="Year range" hint={`You tutor ${yearRangeLabel(min, max)}.`}>
        <div className="relative pt-8 pb-1">
          {/* Floating value labels that track each handle (clamped in-bounds via
              the translateX(-pct%) trick so the ends don't overflow the card). */}
          <span className="absolute top-0 text-[14px] leading-5 tabular-nums font-semibold text-[color:var(--text)] whitespace-nowrap"
            style={{ left: `${minPct}%`, transform: `translateX(-${minPct}%)` }}>{yearLabel(min)}</span>
          <span className="absolute top-0 text-[14px] leading-5 tabular-nums font-semibold text-[color:var(--text)] whitespace-nowrap"
            style={{ left: `${maxPct}%`, transform: `translateX(-${maxPct}%)` }}>{yearLabel(max)}</span>
          <div className="relative h-4">
            <div className="absolute left-0 right-0" style={{ top: "50%", transform: "translateY(-50%)", height: 4, borderRadius: "var(--radius)", background: "var(--rule)", zIndex: 1 }} />
            <div className="absolute" style={{ top: "50%", transform: "translateY(-50%)", height: 4, borderRadius: "var(--radius)", background: "var(--accent)", left: `${minPct}%`, right: `${100 - maxPct}%`, zIndex: 2 }} />
            <input type="range" className="dual-range" style={{ zIndex: 3 }} min={YEAR_MIN} max={YEAR_MAX} step={1} value={min}
              onChange={(e) => setMin(e.target.value)} aria-label="Lowest year level" />
            <input type="range" className="dual-range" style={{ zIndex: 3 }} min={YEAR_MIN} max={YEAR_MAX} step={1} value={max}
              onChange={(e) => setMax(e.target.value)} aria-label="Highest year level" />
          </div>
          {/* K–12 reference scale; ticks inside the selected range light up. */}
          <div className="flex justify-between mt-3">
            {YEAR_LEVELS.map((y) => {
              const inRange = y.value >= min && y.value <= max;
              return (
                <span key={y.value} className="text-[12px] leading-4 tabular-nums"
                  style={{ color: inRange ? "var(--accent)" : "var(--muted)", fontWeight: inRange ? 600 : 400 }}>
                  {y.short}
                </span>
              );
            })}
          </div>
        </div>
      </Field>
  );
  if (bare) return body;
  return (
    <Card>
      <SectionHeader title="Year levels" subtitle="The year groups you tutor. Students filter on this." />
      {body}
    </Card>
  );
}

// No coordinates yet: one plain line instead of a drawn placeholder map
// (DESIGN.md §7: no decorative illustrations).
function ServiceMapPlaceholder() {
  return <p className="text-[14px] leading-5 text-[color:var(--text-2)]">Pick your suburb from the list to see the map.</p>;
}

export function ServiceAreaSection({ tutor, set, bare = false, hideTitle = false }) {
  const Wrap = bare ? Fragment : Card;
  const sa = tutor.serviceArea || { suburb: "", radiusKm: 5 };
  const r = sa.radiusKm;
  const suburb = sa.suburb || "";

  // Debounced geocode: 600ms after the suburb stops changing, fetch coords
  // unless we already have coords for this exact suburb.
  useEffect(() => {
    const trimmed = suburb.trim();
    if (!trimmed) return;
    if (sa.geocodedSuburb && sa.geocodedSuburb.toLowerCase() === trimmed.toLowerCase()
        && Number.isFinite(sa.lat) && Number.isFinite(sa.lng)) {
      return;
    }
    let aborted = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok || aborted) return;
        const body = await res.json();
        if (aborted) return;
        if (Number.isFinite(body?.lat) && Number.isFinite(body?.lng)) {
          set({ serviceArea: { ...sa, lat: body.lat, lng: body.lng, geocodedSuburb: trimmed } });
        } else {
          set({ serviceArea: { ...sa, lat: null, lng: null, geocodedSuburb: null } });
        }
      } catch { /* leave coords as-is on transient error */ }
    }, 600);
    return () => { aborted = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suburb]);

  const hasCoords = Number.isFinite(sa.lat) && Number.isFinite(sa.lng);

  // Picking a suggestion gives us coords directly (no geocode round-trip) and
  // is the single source of truth for the tutor's location: it also mirrors
  // suburb/city onto the profile (used by cards + the public header).
  const onPick = (place) =>
    set({
      serviceArea: { ...sa, suburb: place.suburb, lat: place.lat, lng: place.lng, geocodedSuburb: place.suburb },
      suburb: place.suburb,
      city: place.state || tutor.city || "",
    });

  const onClearSuburb = () =>
    set({
      serviceArea: { ...sa, suburb: "", lat: null, lng: null, geocodedSuburb: null },
      suburb: "",
    });

  return (
    <Wrap>
      <SectionHeader hideTitle={hideTitle} title="Service area" subtitle="Where you travel for in-person lessons." />
      <div className="grid grid-cols-1 gap-6">
        <div>
          <Field label="Base suburb" hint="Type the full suburb name, then wait a couple of seconds for the list to load (the lookup can be slow) and pick your suburb.">
            <SuburbAutocomplete variant="box" value={sa.suburb || ""} placeholder="Chatswood" onSelect={onPick} onClear={onClearSuburb} />
          </Field>
          <div className="mt-6">
            <Field label="Travel radius" hint={`In-person lessons within ${r} km of ${sa.suburb || "your base"}.`}>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={50} step={1} value={r}
                  onChange={(e) => set({ serviceArea: { ...sa, radiusKm: Number(e.target.value) } })} className="flex-1" />
                <span className="w-16 text-right text-[14px] leading-5 tabular-nums font-semibold text-[color:var(--text)]">{r} km</span>
              </div>
            </Field>
          </div>
        </div>
        {hasCoords
          ? <ServiceMapLeaflet lat={sa.lat} lng={sa.lng} radiusKm={r} />
          : <ServiceMapPlaceholder />}
      </div>
    </Wrap>
  );
}

// Day-column indices into AVAILABILITY_DAYS (Mon=0 … Sun=6).
const WEEKDAY_COLS = [0, 1, 2, 3, 4];

// One-click starting points. Each adds its { start, end } hour range (end
// exclusive) to the listed day columns; applying a preset merges into whatever
// the tutor already has rather than replacing it.
const AVAILABILITY_PRESETS = [
  { label: "Weekday afternoons", cols: WEEKDAY_COLS, start: 15, end: 18 },
  { label: "Weekday evenings", cols: WEEKDAY_COLS, start: 17, end: 20 },
  { label: "Weekend mornings", cols: [5, 6], start: 9, end: 12 },
  { label: "Weekends", cols: [5, 6], start: 10, end: 16 },
];

// A single start/end hour dropdown. Options run [min, max] inclusive over hour
// boundaries 0–24 (24 renders as "12 am" = midnight, a valid range end).
function HourSelect({ value, min = 0, max = 24, onChange, ariaLabel }) {
  const opts = [];
  for (let h = min; h <= max; h++) opts.push(h);
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={ariaLabel}
      className="h-11 cursor-pointer rounded border border-input bg-surface px-2 text-[14px] leading-5 tabular-nums text-[color:var(--text)] focus:border-accent"
    >
      {opts.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
    </select>
  );
}

export function AvailabilitySection({ tutor, set, bare = false, hideTitle = false }) {
  const Wrap = bare ? Fragment : Card;
  // Block-based editor. The local `blocks` map ({ Mon: [{start,end}], … }) is
  // initialized once from the stored grid and is the editor's working source of
  // truth; every edit compiles it back to the 24×7 grid (tutor.availability) so
  // storage, the public profile, and saveTutorProfile stay unchanged.
  const [blocks, setBlocks] = useState(() => gridToBlocks(tutor.availability));

  // setBlocks + mirror the compiled grid into tutor state (marks the form dirty
  // and feeds the save path). Only ever called from a user action.
  const update = (next) => {
    setBlocks(next);
    set({ availability: blocksToGrid(next) });
  };

  const addBlock = (day) => {
    const cur = blocks[day] || [];
    const lastEnd = cur.length ? cur[cur.length - 1].end : 16; // default 4 pm
    const start = Math.min(23, lastEnd);
    update({ ...blocks, [day]: [...cur, { start, end: Math.min(24, start + 1) }] });
  };

  const removeBlock = (day, i) =>
    update({ ...blocks, [day]: (blocks[day] || []).filter((_, j) => j !== i) });

  const editBlock = (day, i, patch) =>
    update({ ...blocks, [day]: (blocks[day] || []).map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  const setStart = (day, i, start) => {
    const cur = blocks[day][i];
    editBlock(day, i, { start, end: cur.end <= start ? Math.min(24, start + 1) : cur.end });
  };

  const copyToDays = (day, cols) => {
    const src = (blocks[day] || []).map((b) => ({ ...b }));
    const next = { ...blocks };
    cols.forEach((c) => { next[DAYS[c]] = src.map((b) => ({ ...b })); });
    update(next);
  };

  const applyPreset = (p) => {
    const next = { ...blocks };
    p.cols.forEach((c) => {
      const d = DAYS[c];
      next[d] = [...(next[d] || []), { start: p.start, end: p.end }];
    });
    // Round-trip through the grid so any overlaps collapse into clean ranges.
    update(gridToBlocks(blocksToGrid(next)));
  };

  const clearAll = () => update({});

  const totalBlocks = DAYS.reduce((n, d) => n + (blocks[d]?.length || 0), 0);

  return (
    <Wrap {...(bare ? {} : { padding: 20 })}>
      <SectionHeader hideTitle={hideTitle} title="Availability" subtitle="The times you're usually free to tutor each week. Students see these on your profile."
        right={
          <Button variant="ghost" onClick={clearAll} disabled={totalBlocks === 0}>Clear all</Button>
        } />

      {/* Presets: merge a common pattern in with one click. */}
      <div className="mb-4">
        <MetaLabel>Quick add</MetaLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {AVAILABILITY_PRESETS.map((p) => (
            <Button key={p.label} variant="outline" onClick={() => applyPreset(p)}>{p.label}</Button>
          ))}
        </div>
      </div>

      <div className="border-t border-rule">
        {DAYS.map((d, c) => {
          const dayBlocks = blocks[d] || [];
          return (
            <div key={d} className="flex flex-wrap items-center gap-2 border-b border-rule py-2">
              <div className="w-12 shrink-0 text-[14px] leading-5 font-semibold text-[color:var(--text)]">{d}</div>

              {dayBlocks.length === 0 && (
                <span className="text-[14px] leading-5 text-[color:var(--text-2)]">Not available</span>
              )}

              {dayBlocks.map((b, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <HourSelect value={b.start} min={0} max={23} onChange={(v) => setStart(d, i, v)} ariaLabel={`${d} start`} />
                  <span className="text-[14px] leading-5 text-[color:var(--text-2)]">to</span>
                  <HourSelect value={b.end} min={b.start + 1} max={24} onChange={(v) => editBlock(d, i, { end: v })} ariaLabel={`${d} end`} />
                  <button
                    type="button"
                    onClick={() => removeBlock(d, i)}
                    aria-label={`Remove ${d} ${hourLabel(b.start)} to ${hourLabel(b.end)}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2 hover:text-error"
                    style={{ transition: "background-color 120ms ease-out, color 120ms ease-out" }}
                  >
                    <Icon name="x" size={16} />
                  </button>
                </span>
              ))}

              <Button variant="ghost" size="sm" onClick={() => addBlock(d)}>Add</Button>

              {dayBlocks.length > 0 && (
                <div className="ml-auto flex items-center gap-1">
                  {c < 5 && (
                    <Button variant="ghost" size="sm" onClick={() => copyToDays(d, WEEKDAY_COLS)}>Copy to weekdays</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => copyToDays(d, [0, 1, 2, 3, 4, 5, 6])}>Copy to all</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Wrap>
  );
}


/* ============================================================
   Completion (the owner checklist and onboarding)
   ============================================================ */

// The completion meter and the tutor-ordering algorithm share one definition of
// "complete" — see lib/ranking.js (RANKING_CONFIG). `completionScore` returns the
// same { checks, done, total, pct } shape this sidebar has always rendered, so a
// tutor's % here is exactly what drives their rank on / and /browse.
export const calcCompletion = completionScore;

/* ============================================================
   Save bars
   ============================================================ */

// Sticky save bars (no current caller; kept for the editor shape). White,
// a bottom rule, no blur, no status dot.
export function SaveBar({ tutor, dirty, saving, onSave, onDiscard, profileHref, nameValid = true, top = "var(--nav-h)" }) {
  const router = useRouter();
  const canView = !dirty && !saving && !!profileHref;
  return (
    <div className="sticky z-30 border-b border-rule bg-surface" style={{ top }}>
      <div className="mx-auto flex h-16 max-w-[1128px] items-center gap-4 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar tutor={tutor} size={40} />
          <div className="min-w-0">
            <div className="truncate text-[14px] leading-5 font-semibold text-[color:var(--text)]">{tutor.name || "Your profile"}</div>
            <div className="text-[12px] leading-4 text-muted">{dirty ? "Unsaved changes" : "All changes saved"}</div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="hidden items-center gap-2 sm:flex">
          <Button variant="outline" onClick={onDiscard} disabled={!dirty || saving}>Discard</Button>
          {canView ? (
            <Button variant="primary" onClick={() => router.push(profileHref)}>View profile</Button>
          ) : (
            <Button variant="primary" onClick={onSave} disabled={!dirty || saving || !nameValid}>{saving ? "Saving…" : "Save changes"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MobileSaveBar({ dirty, saving, onSave, onDiscard, profileHref, nameValid = true }) {
  const router = useRouter();
  const canView = !dirty && !saving && !!profileHref;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-2 border-t border-rule bg-surface px-4 py-2 sm:hidden">
      <div className="flex-1 text-[14px] leading-5 text-[color:var(--text-2)]">{dirty ? "Unsaved changes" : "All saved"}</div>
      <Button variant="ghost" onClick={onDiscard} disabled={!dirty || saving}>Discard</Button>
      {canView ? (
        <Button variant="primary" onClick={() => router.push(profileHref)}>View profile</Button>
      ) : (
        <Button variant="primary" onClick={onSave} disabled={!dirty || saving || !nameValid}>{saving ? "Saving…" : "Save"}</Button>
      )}
    </div>
  );
}
