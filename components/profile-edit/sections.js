"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Icon } from "@/components/Icon";
import { Avatar, VerifiedTick, Chip, Button } from "@/components/ui";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import { SubjectPicker } from "@/components/SubjectPicker";
import { SchoolCombobox } from "@/components/SchoolCombobox";
import { RequestVerification } from "@/components/RequestVerification";
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

export const AVATAR_SWATCHES = [
  "oklch(0.92 0.04 80)", "oklch(0.9 0.06 30)", "oklch(0.88 0.07 140)", "oklch(0.9 0.05 220)",
  "oklch(0.88 0.06 280)", "oklch(0.91 0.05 340)", "oklch(0.93 0.03 110)", "oklch(0.86 0.04 50)",
];

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

function Field({ label, hint, error, children, optional, full = true, as: Tag = "label" }) {
  return (
    <Tag className={"block " + (full ? "w-full" : "")}>
      {label && (
        <div className="text-[11.5px] text-slate-500 uppercase tracking-wider font-medium mb-1.5 flex items-center gap-2">
          <span>{label}</span>
          {optional && <span className="text-slate-400 normal-case tracking-normal text-[11px]">Optional</span>}
        </div>
      )}
      {children}
      {(hint || error) && (
        <div className={"text-[12px] mt-1.5 " + (error ? "text-rose-600" : "text-slate-500")}>{error || hint}</div>
      )}
    </Tag>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", inputMode, prefix, suffix, multiline, rows = 4, maxLength, onBlur }) {
  const [focus, setFocus] = useState(false);
  const Tag = multiline ? "textarea" : "input";
  return (
    <div
      className="flex items-stretch"
      style={{
        background: "var(--bg-soft)",
        borderRadius: 10,
        border: `1px solid ${focus ? "var(--ink)" : "transparent"}`,
        transition: "border-color 120ms ease",
      }}
    >
      {prefix && <span className="flex items-center pl-3.5 pr-1 text-[14px] text-slate-500 tabular-nums">{prefix}</span>}
      <Tag
        type={multiline ? undefined : type}
        inputMode={inputMode}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); onBlur?.(); }}
        placeholder={placeholder}
        rows={multiline ? rows : undefined}
        maxLength={maxLength}
        className="w-full bg-transparent outline-none text-[14.5px] text-slate-900 placeholder:text-slate-400"
        style={{
          padding: multiline ? "10px 16px" : "10px 16px",
          paddingLeft: prefix ? 4 : undefined,
          paddingRight: suffix ? 4 : undefined,
          resize: multiline ? "vertical" : "none",
          lineHeight: multiline ? 1.55 : 1.3,
          fontFamily: "inherit",
          letterSpacing: "-0.003em",
        }}
      />
      {suffix && <span className="flex items-center whitespace-nowrap pl-1 pr-3.5 text-[14px] text-slate-500 tabular-nums">{suffix}</span>}
    </div>
  );
}

/**
 * Textarea with a formatting toolbar (emoji / bold / italic, plus optional
 * bulleted + numbered lists). Writes the tiny markdown subset documented in
 * lib/richText.js; the public profile renders it via <RichText>.
 */
function RichTextField({ value, onChange, placeholder, rows = 4, maxLength, lists = false, ai }) {
  const taRef = useRef(null);
  const [focus, setFocus] = useState(false);
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
      onMouseDown={(e) => e.preventDefault()} // keep textarea selection
      onClick={onClick}
      className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
      style={active ? { background: "rgba(0,30,30,0.08)", color: "var(--ink)" } : undefined}
    >
      <Icon name={icon} size={15} strokeWidth={2} />
    </button>
  );

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={{
        background: "var(--bg-soft)",
        borderRadius: 10,
        border: `1px solid ${focus ? "var(--ink)" : "transparent"}`,
        transition: "border-color 120ms ease",
      }}
    >
      <div className="flex items-center gap-0.5 px-2 pt-1.5 pb-1 border-b border-slate-200/70">
        <div className="relative">
          <ToolbarBtn icon="smile" label="Insert emoji" active={emojiOpen} onClick={() => setEmojiOpen((o) => !o)} />
          {emojiOpen && (
            <div
              className="absolute left-0 top-9 z-30"
              style={{ boxShadow: "0 12px 32px rgba(0,30,30,0.18)", borderRadius: 12 }}
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
        <span className="w-px h-4 bg-slate-200 mx-1" />
        <ToolbarBtn icon="bold" label="Bold" onClick={() => wrap("**")} />
        <ToolbarBtn icon="italic" label="Italic" onClick={() => wrap("*")} />
        {lists && (
          <>
            <span className="w-px h-4 bg-slate-200 mx-1" />
            <ToolbarBtn icon="list" label="Bulleted list" onClick={() => toggleList("ul")} />
            <ToolbarBtn icon="list-ordered" label="Numbered list" onClick={() => toggleList("ol")} />
          </>
        )}
        {ai && (
          <div className="ml-auto flex items-center gap-2">
            {ai.usage && typeof ai.usage.remaining === "number" && (
              <span className="text-[12px] text-slate-400 tabular-nums whitespace-nowrap">
                {ai.usage.remaining}/{ai.usage.limit} left
                {ai.usage.resetsAt && (
                  <span className="hidden sm:inline">
                    {" · resets "}
                    {new Date(ai.usage.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
              </span>
            )}
            <button
              type="button"
              aria-label={ai.label || "Generate with AI"}
              title={ai.label || "Generate with AI"}
              onMouseDown={(e) => e.preventDefault()} // keep textarea selection
              onClick={runGenerate}
              disabled={genState === "loading" || ai.usage?.remaining === 0}
              className="inline-flex items-center gap-1.5 h-7 pl-1.5 pr-2.5 rounded-md text-[12.5px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors disabled:opacity-60 disabled:cursor-default"
              style={genState === "loading" || genState === "preview" ? { background: "rgba(0,30,30,0.08)", color: "var(--ink)" } : undefined}
            >
              <Icon name="sparkle" size={15} strokeWidth={2} />
              {genState === "loading" ? "Generating…" : "Generate with AI"}
            </button>
          </div>
        )}
      </div>
      <textarea
        ref={taRef}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="w-full bg-transparent outline-none text-[14.5px] text-slate-900 placeholder:text-slate-400"
        style={{
          padding: "10px 14px",
          resize: "vertical",
          lineHeight: 1.55,
          fontFamily: "inherit",
          letterSpacing: "-0.003em",
        }}
      />
      {ai && genState !== "idle" && (
        <div className="border-t border-slate-200/70 px-3 py-2.5">
          {genState === "loading" && (
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
              <Icon name="sparkle" size={14} strokeWidth={2} />
              Generating…
            </div>
          )}
          {genState === "error" && (
            <div>
              <p className="text-[13px] text-rose-600">{genError}</p>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="soft" icon="sparkle" onClick={runGenerate}>Try again</Button>
                <Button size="sm" variant="ghost" onClick={dismissPreview}>Dismiss</Button>
              </div>
            </div>
          )}
          {genState === "preview" && (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1.5">AI draft — preview</div>
              <div
                className="text-[14px] text-slate-800 whitespace-pre-wrap rounded-lg bg-[color:var(--paper-card)] border border-slate-200 px-3 py-2"
                style={{ lineHeight: 1.55 }}
              >
                {preview}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <Button size="sm" variant="dark" icon="check" onClick={acceptPreview}>Accept</Button>
                <Button size="sm" variant="outline" icon="sparkle" onClick={runGenerate}>Regenerate</Button>
                <Button size="sm" variant="ghost" icon="x" onClick={dismissPreview}>Dismiss</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Select({ value, onChange, options }) {
  const [focus, setFocus] = useState(false);
  return (
    <div
      className="relative"
      style={{
        background: "var(--bg-soft)",
        borderRadius: 10,
        border: `1px solid ${focus ? "var(--ink)" : "transparent"}`,
        transition: "border-color 120ms ease",
      }}
    >
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        className="w-full bg-transparent outline-none text-[14.5px] text-slate-900 appearance-none"
        style={{ padding: "10px 36px 10px 14px", fontFamily: "inherit", letterSpacing: "-0.003em" }}
      >
        {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        <Icon name="chevron-down" size={14} />
      </span>
    </div>
  );
}

function Toggle({ value, onChange, label, hint }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-start gap-3 w-full text-left py-1">
      <span className="relative inline-block shrink-0 mt-0.5"
        style={{ width: 36, height: 22, borderRadius: 999, background: value ? "var(--ink)" : "var(--paper-line)", transition: "background 140ms ease" }}>
        <span className="absolute top-0.5 inline-block bg-[color:var(--paper-card)]"
          style={{ width: 18, height: 18, borderRadius: "50%", left: value ? 16 : 2, transition: "left 140ms ease", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-medium text-slate-900">{label}</span>
        {hint && <span className="block text-[12.5px] text-slate-500 mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

function Card({ children, padding = 24, className = "" }) {
  return (
    <section className={"bg-[color:var(--paper-card)] " + className} style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding }}>
      {children}
    </section>
  );
}

function SectionHeader({ title, subtitle, right, icon }) {
  return (
    <header className="flex items-start justify-between gap-4 mb-5">
      <div className="min-w-0">
        <h2 className="text-[18px] font-light text-slate-800 tracking-tight flex items-center gap-2">
          {icon && <span className="text-slate-400"><Icon name={icon} size={16} /></span>}{title}
        </h2>
        {subtitle && <p className="text-[13px] text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}

function MetaLabel({ children }) {
  return <div className="text-[11.5px] text-slate-500 uppercase tracking-wider font-medium">{children}</div>;
}

function move(arr, from, to) {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function ReorderRow({ index, count, onMove, onRemove, children }) {
  return (
    <div className="group relative flex items-stretch gap-3 py-3" style={{ borderTop: index === 0 ? "none" : "1px solid var(--desk)" }}>
      <div className="flex flex-col items-center justify-center pt-2 text-slate-300 select-none">
        <button type="button" onClick={() => onMove(Math.max(0, index - 1))} disabled={index === 0} className="hover:text-slate-700 disabled:opacity-30" aria-label="Move up"><Icon name="chevron-up" size={14} /></button>
        <span className="text-slate-300 my-0.5"><Icon name="grip" size={14} /></span>
        <button type="button" onClick={() => onMove(Math.min(count - 1, index + 1))} disabled={index === count - 1} className="hover:text-slate-700 disabled:opacity-30" aria-label="Move down"><Icon name="chevron-down" size={14} /></button>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
      <button type="button" onClick={onRemove} className="self-start mt-2 text-slate-400 hover:text-rose-600 transition-colors" aria-label="Remove" title="Remove">
        <Icon name="trash" size={15} />
      </button>
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
        className="flex flex-wrap items-center gap-1.5"
        onClick={() => ref.current?.focus()}
        style={{
          background: "var(--bg-soft)",
          borderRadius: 10,
          border: `1px solid ${focus ? "var(--ink)" : "transparent"}`,
          padding: "7px 9px",
          minHeight: 40,
          cursor: "text",
          transition: "border-color 120ms ease",
        }}
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
          className="flex-1 min-w-[100px] bg-transparent outline-none text-[14px] text-slate-900 placeholder:text-slate-400"
          style={{ padding: "2px 4px" }}
        />
      </div>
      {focus && remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {remaining.map((s) => (
            <button
              type="button"
              key={s}
              onMouseDown={(e) => { e.preventDefault(); add(s); }}
              className="text-[12px] text-slate-500 hover:text-slate-900 px-2 py-1 rounded-full"
              style={{ background: "var(--bg-soft)", border: "1px solid var(--desk)" }}
            >+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Sections
   ============================================================ */

function ImageUploadControl({ label, value, kind, supabase, userId, onChange, hint, aspect, cropShape, maxOutputPx }) {
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
    const res = await uploadProfileImage(supabase, userId, kind, croppedFile);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    onChange(res.url);
  };

  const isRound = (cropShape ?? "rect") === "round";
  const previewH = 56;
  const previewW = isRound ? previewH : Math.round(previewH * (aspect ?? 1));

  return (
    <div>
      <MetaLabel>{label}</MetaLabel>
      <div className="flex items-start gap-3 mt-2">
        <div
          className="shrink-0 overflow-hidden bg-[color:var(--bg-soft)] flex items-center justify-center"
          style={{
            width: previewW,
            height: previewH,
            borderRadius: isRound ? "50%" : 10,
            border: "1px solid var(--paper-line)",
          }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={`${label} preview`} className="w-full h-full object-cover" />
          ) : (
            <Icon name="image" size={20} className="text-slate-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
            <Button variant="outline" size="sm" icon="upload" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? "Uploading…" : value ? "Replace" : "Upload"}
            </Button>
            {value && !busy && (
              <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Remove</Button>
            )}
          </div>
          {err
            ? <div className="text-[12px] text-rose-600 mt-1.5">{err}</div>
            : hint && <div className="text-[12px] text-slate-400 mt-1.5">{hint}</div>}
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

// Just the image portion of BannerAvatarSection — the avatar + banner uploads
// and the banner-colour swatch. Split out so the onboarding wizard can surface
// image upload on step 1 without dragging in the delivery toggles (which it
// asks separately). BannerAvatarSection composes this + delivery + response.
export function ProfileImagesSection({ tutor, set, supabase, bare = false }) {
  const swatchesDisabled = !!tutor.bannerImg;
  const body = (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ImageUploadControl
          label="Avatar image"
          value={tutor.avatarImg}
          kind="avatar"
          supabase={supabase}
          userId={tutor.id}
          onChange={(url) => set({ avatarImg: url })}
          hint="Square works best. Falls back to a graduation cap when empty."
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
          hint="Wide image, ~1200×320. Falls back to the colour below."
          aspect={1200 / 320}
          cropShape="rect"
          maxOutputPx={2400}
        />
      </div>
      <div className="mt-4" style={{ opacity: swatchesDisabled ? 0.5 : 1 }}>
        <MetaLabel>Banner colour</MetaLabel>
        <div className="flex flex-wrap gap-2 mt-2">
          {AVATAR_SWATCHES.map((c) => {
            const selectedBanner = tutor.bannerBg ?? tutor.avatarBg;
            return (
              <button
                key={c}
                type="button"
                onClick={() => set({ bannerBg: c })}
                disabled={swatchesDisabled}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: c,
                  border: `2px solid ${selectedBanner === c ? "var(--ink)" : "transparent"}`,
                  boxShadow: "inset 0 0 0 1px var(--paper-line)",
                  cursor: swatchesDisabled ? "not-allowed" : "pointer",
                }}
                aria-label="Pick swatch"
              />
            );
          })}
        </div>
        {swatchesDisabled && (
          <div className="text-[12px] text-slate-400 mt-1.5">
            Used only when no banner image is set.
          </div>
        )}
      </div>
    </>
  );
  if (bare) return body;
  return (
    <Card padding={20}>
      <SectionHeader title="Profile images" subtitle="Your photo and banner at the top of your profile." />
      {body}
    </Card>
  );
}

export function BannerAvatarSection({ tutor, set, supabase, bare = false }) {
  const body = (
    <>
      <ProfileImagesSection tutor={tutor} set={set} supabase={supabase} bare />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5 pt-5" style={{ borderTop: "1px solid var(--desk)" }}>
        <Toggle value={tutor.deliversInPerson} onChange={(v) => set({ deliversInPerson: v })} label="Accepts in-person lessons" hint="Inside the service area you set below." />
        <Toggle value={tutor.deliversOnline} onChange={(v) => set({ deliversOnline: v })} label="Accepts online lessons" hint="Over Zoom or Google Meet." />
      </div>
      <div className="mt-4">
        <Field label="Response time">
          <Select value={tutor.responsiveText} onChange={(v) => set({ responsiveText: v })} options={RESPONSE_OPTIONS} />
        </Field>
      </div>
    </>
  );
  if (bare) return body;
  return (
    <Card padding={20}>
      <SectionHeader title="Banner & avatar" subtitle="The banner, your photo and badges visible at the top of your profile." />
      {body}
    </Card>
  );
}

export function IdentitySection({ tutor, set, bare = false }) {
  const nameError = (tutor.name || "").trim() ? undefined : "Your full name is required.";
  const body = (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Full name" hint="Use the name that matches your government ID." error={nameError}><TextInput value={tutor.name} onChange={(v) => set({ name: v, initial: (v || " ").charAt(0).toUpperCase() })} placeholder="Amelia Tran" /></Field>
        <Field label="Years tutoring">
          <TextInput value={tutor.yearsTutoring || ""} onChange={(v) => set({ yearsTutoring: Number(v.replace(/\D/g, "")) || 0 })} suffix="yrs" placeholder="3" inputMode="numeric" />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Languages spoken">
          <TagInput values={tutor.languages} onChange={(v) => set({ languages: v })} suggestions={LANGUAGE_SUGGESTIONS} placeholder="Add a language" />
        </Field>
      </div>
    </>
  );
  if (bare) return body;
  return (
    <Card>
      <SectionHeader title="Identity" subtitle="Shown directly under your avatar on the public profile." />
      {body}
    </Card>
  );
}

const CREDENTIAL_TYPES = [
  { value: "atar",        label: "ATAR",       caption: "ATAR",       kind: "stat",       placeholder: "98.05" },
  { value: "trophy",      label: "Award",      caption: "AWARD",      kind: "credential", placeholder: "All-Round Achiever 2021" },
  { value: "graduation",  label: "Degree",     caption: "DEGREE",     kind: "credential", placeholder: "B. Computer Science @ CMU" },
  { value: "check-badge", label: "State rank", caption: "STATE RANK", kind: "credential", placeholder: "1st in Chemistry, 2021" },
  { value: "star",        label: "Highlight",  caption: "HIGHLIGHT",  kind: "credential", placeholder: "Top 1% nationally" },
];

function typeForIcon(icon) {
  return CREDENTIAL_TYPES.find((t) => t.value === icon) ?? { caption: "CREDENTIAL", kind: "credential", placeholder: "" };
}

const EDUCATION_LEVELS = [
  { value: "high_school", label: "High School" },
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

export function CredentialsSection({ tutor, set, bare = false }) {
  const Wrap = bare ? Fragment : Card;
  const list = tutor.credentials || [];
  const update = (i, p) => set({ credentials: list.map((c, idx) => idx === i ? { ...c, ...p } : c) });
  const remove = (i) => set({ credentials: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ credentials: move(list, i, to) });
  const add = () => set({ credentials: [...list, { label: "", icon: "trophy" }] });

  return (
    <Wrap>
      <SectionHeader title="Credentials" subtitle="Your achievements go here. The one at the top is featured on your profile card."
        right={<Button variant="outline" size="sm" icon="plus" onClick={add}>Add credential</Button>} />
      {list.length === 0 && <div className="text-[13.5px] text-slate-500 py-6 text-center" style={{ background: "var(--bg-soft)", borderRadius: 10 }}>No credentials yet — add an ATAR, award, degree, or state rank.</div>}
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
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <Select value={c.icon} onChange={(v) => update(i, { icon: v })} options={opts} />
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

export function AboutSection({ tutor, set, bare = false }) {
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
      <SectionHeader title="About" subtitle="The story students read on your profile." />
      <Field as="div" label="Tagline" hint="One line shown on your browse cards and under your profile header.">
        <RichTextField rows={2} value={tutor.bio} onChange={(v) => set({ bio: v })} maxLength={180}
          ai={{ onGenerate: () => generate("tagline"), label: "Generate tagline with AI", usage }}
          placeholder="Patient, structured tutor who writes clear notes…" />
      </Field>
      <div className="mt-5">
        <Field as="div" label="Long bio"
          error={over ? `${wordCount - SOFT_LIMIT} words over the soft limit — consider trimming.` : null}
          hint={!over ? `${wordCount} / ${SOFT_LIMIT} words` : null}>
          <RichTextField rows={8} value={long} onChange={(v) => set({ bioLong: v })} lists
            ai={{ onGenerate: () => generate("bio"), label: "Generate bio with AI", usage }}
            placeholder="Tell students about your teaching approach…" />
        </Field>
      </div>
    </Wrap>
  );
}

export function RateSection({ tutor, set, bare = false }) {
  const Wrap = bare ? Fragment : Card;
  const list = tutor.packages || [];
  const update = (i, p) => set({ packages: list.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const remove = (i) => set({ packages: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ packages: move(list, i, to) });
  const add = () => set({ packages: [...list, { label: "", price: tutor.rate || 0 }] });
  return (
    <Wrap>
      <SectionHeader title="Rate & packages" subtitle="Base rate and the bundles students can buy."
        right={<Button variant="outline" size="sm" icon="plus" onClick={add}>Add package</Button>} />
      <Field label="Hourly rate">
        <div className="max-w-[200px]">
          <TextInput value={tutor.rate || ""} onChange={(v) => set({ rate: Number(v.replace(/\D/g, "")) || 0 })} prefix="$" suffix="/ hr" placeholder="40" inputMode="numeric" />
        </div>
      </Field>
      <div className="mt-5">
        <MetaLabel>Packages</MetaLabel>
        <div className="mt-2">
          {list.map((p, i) => (
            <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <TextInput value={p.label} onChange={(v) => update(i, { label: v })} placeholder="5-lesson pack" />
                <TextInput value={p.price} onChange={(v) => update(i, { price: Number(v.replace(/\D/g, "")) || 0 })} prefix="$" />
              </div>
            </ReorderRow>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

export function ExperienceSection({ tutor, set, bare = false }) {
  const Wrap = bare ? Fragment : Card;
  const list = tutor.experience || [];
  const update = (i, p) => set({ experience: list.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const remove = (i) => set({ experience: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ experience: move(list, i, to) });
  const add = () => set({ experience: [...list, { role: "", org: "", period: "", note: "" }] });
  return (
    <Wrap>
      <SectionHeader title="Experience" subtitle="Renders as the briefcase timeline on your profile."
        right={<Button variant="outline" size="sm" icon="plus" onClick={add}>Add role</Button>} />
      <div>
        {list.map((e, i) => (
          <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <TextInput value={e.role} onChange={(v) => update(i, { role: v })} placeholder="Private tutor" />
              <TextInput value={e.org} onChange={(v) => update(i, { org: v })} placeholder="Self-employed" />
              <TextInput value={e.period} onChange={(v) => update(i, { period: v })} placeholder="2022 — present" />
            </div>
            <div className="mt-2">
              <TextInput value={e.note} onChange={(v) => update(i, { note: v })} placeholder="One line describing what you did here." />
            </div>
          </ReorderRow>
        ))}
      </div>
    </Wrap>
  );
}

export function EducationSection({ tutor, set, schoolCatalog = [], bare = false }) {
  const Wrap = bare ? Fragment : Card;
  const list = tutor.education || [];
  const update = (i, p) => set({ education: list.map((x, idx) => idx === i ? { ...x, ...p } : x) });
  const remove = (i) => set({ education: list.filter((_, idx) => idx !== i) });
  const moveTo = (i, to) => set({ education: move(list, i, to) });
  const add = () => set({ education: [...list, { school: "", detail: "", level: "high_school", schoolSlug: null }] });
  return (
    <Wrap>
      <SectionHeader title="Education" right={<Button variant="outline" size="sm" icon="plus" onClick={add}>Add school</Button>} />
      <div>
        {list.map((e, i) => {
          const level = e.level ?? "high_school";
          return (
            <ReorderRow key={i} index={i} count={list.length} onMove={(to) => moveTo(i, to)} onRemove={() => remove(i)}>
              <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_1.4fr] gap-2">
                {/* Switching away from high school clears any listed-school link. */}
                <Select value={level} onChange={(v) => update(i, v === "high_school" ? { level: v } : { level: v, schoolSlug: null })} options={EDUCATION_LEVELS} />
                {level === "high_school" ? (
                  <SchoolCombobox
                    value={e.school}
                    schoolSlug={e.schoolSlug ?? null}
                    catalog={schoolCatalog}
                    onChange={({ school, schoolSlug }) => update(i, { school, schoolSlug })}
                    placeholder="James Ruse Agricultural High School"
                  />
                ) : (
                  <TextInput value={e.school} onChange={(v) => update(i, { school: v })} placeholder="UNSW Sydney" />
                )}
                <TextInput value={e.detail} onChange={(v) => update(i, { detail: v })} placeholder={level === "high_school" ? "Year 7 - 12" : "B. Medical Studies — Year 3"} />
              </div>
            </ReorderRow>
          );
        })}
      </div>
    </Wrap>
  );
}

export function SubjectsSection({ tutor, set, catalog, bare = false }) {
  const Wrap = bare ? Fragment : Card;
  // The dropdown is absolutely positioned, so it can't grow the host modal on
  // its own. Reserve an in-flow spacer equal to the open panel's height so the
  // modal expands to fit it — and collapses back (no empty space) on close.
  const [reserve, setReserve] = useState(0);
  return (
    <Wrap>
      <SectionHeader title="Subjects" subtitle="Powers your placement in browse filters. Pick an exam, then choose the subjects you tutor." />
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
          <span className="absolute top-0 text-[13px] tabular-nums font-medium text-slate-900 whitespace-nowrap"
            style={{ left: `${minPct}%`, transform: `translateX(-${minPct}%)` }}>{yearLabel(min)}</span>
          <span className="absolute top-0 text-[13px] tabular-nums font-medium text-slate-900 whitespace-nowrap"
            style={{ left: `${maxPct}%`, transform: `translateX(-${maxPct}%)` }}>{yearLabel(max)}</span>
          <div className="relative h-4">
            <div className="absolute left-0 right-0" style={{ top: "50%", transform: "translateY(-50%)", height: 6, borderRadius: 999, background: "var(--paper-line)", zIndex: 1 }} />
            <div className="absolute" style={{ top: "50%", transform: "translateY(-50%)", height: 6, borderRadius: 999, background: "var(--accent)", left: `${minPct}%`, right: `${100 - maxPct}%`, zIndex: 2 }} />
            <input type="range" className="dual-range" style={{ zIndex: 3 }} min={YEAR_MIN} max={YEAR_MAX} step={1} value={min}
              onChange={(e) => setMin(e.target.value)} aria-label="Lowest year level" />
            <input type="range" className="dual-range" style={{ zIndex: 3 }} min={YEAR_MIN} max={YEAR_MAX} step={1} value={max}
              onChange={(e) => setMax(e.target.value)} aria-label="Highest year level" />
          </div>
          {/* K–12 reference scale; ticks inside the selected range light up. */}
          <div className="flex justify-between mt-2.5">
            {YEAR_LEVELS.map((y) => {
              const inRange = y.value >= min && y.value <= max;
              return (
                <span key={y.value} className="text-[11px] tabular-nums"
                  style={{ color: inRange ? "var(--accent)" : "var(--sage)", fontWeight: inRange ? 600 : 400 }}>
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
      <SectionHeader title="Year levels" subtitle="The range of year groups you'll tutor — students filter on this." />
      {body}
    </Card>
  );
}

function ServiceMapPlaceholder({ radiusKm }) {
  const radius = 18 + (Math.min(50, Math.max(1, radiusKm)) / 50) * 68;
  return (
    <div style={{ background: "var(--bg-soft)", border: "1px solid var(--desk)", borderRadius: 12, overflow: "hidden", height: 200 }} className="relative">
      <svg viewBox="0 0 280 200" width="100%" height="100%">
        <defs>
          <pattern id="grid-bg" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--paper-line)" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="280" height="200" fill="url(#grid-bg)" />
        <path d="M 0 130 C 80 120 160 150 280 110" stroke="var(--paper-line)" strokeWidth="6" fill="none"/>
        <path d="M 60 0 C 80 60 120 110 100 200" stroke="var(--paper-line)" strokeWidth="4" fill="none"/>
        <path d="M 200 0 L 180 200" stroke="var(--paper-line)" strokeWidth="3" fill="none"/>
        <circle cx="140" cy="100" r={radius} fill="var(--ink)" fillOpacity="0.06" stroke="var(--ink)" strokeWidth="1.25" strokeDasharray="4 4"/>
        <circle cx="140" cy="100" r="4" fill="var(--ink)"/>
        <circle cx="140" cy="100" r="9" fill="none" stroke="var(--ink)" strokeWidth="1.25" opacity="0.4"/>
      </svg>
      <div className="absolute top-2.5 left-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">{radiusKm} km radius</div>
    </div>
  );
}

export function ServiceAreaSection({ tutor, set, bare = false }) {
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
      <SectionHeader title="Service area" subtitle="Where you'll travel for in-person lessons." />
      <div className="grid grid-cols-1 gap-5">
        <div>
          <Field label="Base suburb" hint="Type the full suburb name, then wait a couple of seconds for the list to load (the lookup can be slow) and pick your suburb.">
            <SuburbAutocomplete variant="box" value={sa.suburb || ""} placeholder="Chatswood" onSelect={onPick} onClear={onClearSuburb} />
          </Field>
          <div className="mt-4">
            <Field label="Travel radius" hint={`In-person lessons within ${r} km of ${sa.suburb || "your base"}.`}>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={50} step={1} value={r}
                  onChange={(e) => set({ serviceArea: { ...sa, radiusKm: Number(e.target.value) } })} className="flex-1" />
                <span className="text-[14px] tabular-nums font-medium text-slate-900 w-14 text-right">{r} km</span>
              </div>
            </Field>
          </div>
        </div>
        {hasCoords
          ? <ServiceMapLeaflet lat={sa.lat} lng={sa.lng} radiusKm={r} />
          : <ServiceMapPlaceholder radiusKm={r} />}
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
function HourSelect({ value, min = 0, max = 24, onChange }) {
  const opts = [];
  for (let h = min; h <= max; h++) opts.push(h);
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="text-[13px] text-slate-700 bg-[color:var(--paper-card)] rounded-md px-1.5 py-1 tabular-nums focus:outline-none cursor-pointer"
      style={{ border: "1px solid var(--paper-line)" }}
    >
      {opts.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
    </select>
  );
}

export function AvailabilitySection({ tutor, set, bare = false }) {
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
      <SectionHeader title="Availability" subtitle="Add the times you're free to tutor each day. Students see these on your profile."
        right={
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={totalBlocks === 0}>Clear all</Button>
        } />

      {/* Presets — merge a common pattern in with one click. */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-[11.5px] text-slate-400 uppercase tracking-wider font-medium mr-1">Quick add</span>
        {AVAILABILITY_PRESETS.map((p) => (
          <Button key={p.label} variant="ghost" size="sm" icon="sparkle" onClick={() => applyPreset(p)}>{p.label}</Button>
        ))}
      </div>

      <div className="divide-y" style={{ borderColor: "var(--desk)" }}>
        {DAYS.map((d, c) => {
          const dayBlocks = blocks[d] || [];
          return (
            <div key={d} className="flex flex-wrap items-center gap-2 py-2.5">
              <div className="w-10 shrink-0 text-[12px] font-medium text-slate-700 uppercase tracking-wider">{d}</div>

              {dayBlocks.length === 0 && (
                <span className="text-[13px] text-slate-400">Not available</span>
              )}

              {dayBlocks.map((b, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1" style={{ background: "var(--bg-soft)", border: "1px solid #EEF2F6" }}>
                  <HourSelect value={b.start} min={0} max={23} onChange={(v) => setStart(d, i, v)} />
                  <span className="text-[12px] text-slate-400">to</span>
                  <HourSelect value={b.end} min={b.start + 1} max={24} onChange={(v) => editBlock(d, i, { end: v })} />
                  <button
                    type="button"
                    onClick={() => removeBlock(d, i)}
                    aria-label={`Remove ${d} ${hourLabel(b.start)}–${hourLabel(b.end)}`}
                    className="ml-0.5 inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </span>
              ))}

              <button
                type="button"
                onClick={() => addBlock(d)}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-700 hover:text-emerald-800 px-1.5 py-1 rounded hover:bg-emerald-50 transition-colors"
              >
                <Icon name="plus" size={13} /> Add
              </button>

              {dayBlocks.length > 0 && (
                <div className="flex items-center gap-1 ml-auto">
                  {c < 5 && (
                    <button type="button" onClick={() => copyToDays(d, WEEKDAY_COLS)}
                      className="text-[12px] text-slate-400 hover:text-slate-700 px-1.5 py-1 rounded hover:bg-slate-50 transition-colors">
                      Copy to weekdays
                    </button>
                  )}
                  <button type="button" onClick={() => copyToDays(d, [0, 1, 2, 3, 4, 5, 6])}
                    className="text-[12px] text-slate-400 hover:text-slate-700 px-1.5 py-1 rounded hover:bg-slate-50 transition-colors">
                    Copy to all
                  </button>
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
   Sidebar (completion meter, visibility, public link)
   ============================================================ */

// The completion meter and the tutor-ordering algorithm share one definition of
// "complete" — see lib/ranking.js (RANKING_CONFIG). `completionScore` returns the
// same { checks, done, total, pct } shape this sidebar has always rendered, so a
// tutor's % here is exactly what drives their rank on / and /browse.
export const calcCompletion = completionScore;

export function Sidebar({ tutor, set, publicHref, publicUrl }) {
  const c = useMemo(() => calcCompletion(tutor), [tutor]);
  const visOptions = [
    { value: "public",   label: "Public", hint: "Visible to everyone." },
    { value: "hidden",   label: "Hidden", hint: "Profile is offline." },
  ];
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const copyPublicHref = async () => {
    const toCopy = publicUrl || publicHref;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(toCopy);
      } else {
        const ta = document.createElement("textarea");
        ta.value = toCopy;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <aside className="space-y-5">
      <RequestVerification status={tutor.verificationStatus} completionPct={c.pct} />

      <Card padding={20}>
        <h3 className="text-[14px] font-light text-slate-800 tracking-tight mb-3">Profile visibility</h3>
        <div className="space-y-1.5">
          {visOptions.map((o) => (
            <button key={o.value} type="button" onClick={() => set({ visibility: o.value })}
              className="w-full text-left flex items-start gap-3 px-3 py-2.5 transition-colors"
              style={{ background: tutor.visibility === o.value ? "var(--ink)" : "var(--bg-soft)", color: tutor.visibility === o.value ? "#fff" : "var(--ink)", borderRadius: 10, border: `1px solid ${tutor.visibility === o.value ? "var(--ink)" : "transparent"}` }}>
              <span className="inline-flex items-center justify-center shrink-0 mt-0.5"
                style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${tutor.visibility === o.value ? "#fff" : "var(--line-strong)"}`, background: tutor.visibility === o.value ? "#fff" : "transparent" }}>
                {tutor.visibility === o.value && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ink)" }} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-medium">{o.label}</span>
                <span className={"block text-[12px] mt-0.5 " + (tutor.visibility === o.value ? "text-white/70" : "text-slate-500")}>{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <Card padding={20}>
        <h3 className="text-[14px] font-light text-slate-800 tracking-tight mb-3">Public profile link</h3>
        <button
          type="button"
          onClick={copyPublicHref}
          title={copied ? "Copied!" : "Click to copy"}
          className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-100"
          style={{ background: "var(--bg-soft)", borderRadius: 10 }}
        >
          <Icon name={copied ? "check" : "globe"} size={14} className={(copied ? "text-emerald-500" : "text-slate-400") + " shrink-0"} />
          <code className="text-[12.5px] text-slate-700 truncate flex-1 min-w-0">{publicHref}</code>
          <span className={"text-[11px] font-medium shrink-0 " + (copied ? "text-emerald-600" : "text-slate-400")}>
            {copied ? "Copied" : "Copy"}
          </span>
        </button>
      </Card>

      <Card padding={20}>
        <h3 className="text-[14px] font-light text-slate-800 tracking-tight mb-2">Profile completion</h3>
        <div style={{ height: 6, background: "var(--desk)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${c.pct}%`, height: "100%", background: c.pct >= 80 ? "var(--accent)" : "var(--ink)", transition: "width 220ms ease" }} />
        </div>
        <ul className="mt-4 space-y-2">
          {c.checks.map((ch) => (
            <li key={ch.key} className="flex items-center gap-2 text-[13px]">
              <span className="inline-flex items-center justify-center shrink-0"
                style={{ width: 16, height: 16, borderRadius: "50%", background: ch.ok ? "var(--accent)" : "var(--desk)", color: ch.ok ? "#fff" : "var(--sage)" }}>
                {ch.ok ? <Icon name="check" size={10} strokeWidth={3} /> : <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--sage)" }} />}
              </span>
              <span className={ch.ok ? "text-slate-600 line-through decoration-slate-300" : "text-slate-700"}>{ch.key}</span>
              {ch.soon && (
                <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", color: "var(--sage)" }}>
                  Coming soon
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </aside>
  );
}

/* ============================================================
   Save bars
   ============================================================ */

export function SaveBar({ tutor, dirty, saving, onSave, onDiscard, profileHref, nameValid = true, top = "var(--nav-h)" }) {
  const router = useRouter();
  const canView = !dirty && !saving && !!profileHref;
  return (
    <div className="sticky z-30 bg-[rgba(251,247,236,0.85)] backdrop-blur" style={{ top, borderBottom: "1px solid var(--paper-line)" }}>
      <div className="max-w-[1200px] mx-auto px-6 h-[68px] flex items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar tutor={tutor} size={36} />
          <div className="min-w-0">
            <div className="text-[14.5px] font-medium text-slate-900 truncate" style={{ letterSpacing: "-0.01em" }}>{tutor.name || "Your profile"}</div>
            <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
              <span className="inline-block" style={{ width: 7, height: 7, borderRadius: "50%", background: dirty ? "#F59E0B" : "#10B981", boxShadow: dirty ? "0 0 0 3px rgba(245,158,11,0.18)" : "0 0 0 3px rgba(16,185,129,0.18)" }} />
              {dirty ? "Unsaved changes" : "All changes saved"}
            </div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDiscard} disabled={!dirty || saving}>Discard</Button>
          {canView ? (
            <Button variant="primary" size="sm" onClick={() => router.push(profileHref)}>View profile</Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onSave} disabled={!dirty || saving || !nameValid}>{saving ? "Saving…" : "Save changes"}</Button>
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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[color:var(--paper-card)] px-4 py-3 flex items-center gap-3" style={{ borderTop: "1px solid var(--paper-line)" }}>
      <div className="flex-1 text-[13px] text-slate-600">{dirty ? "You have unsaved changes" : "All saved"}</div>
      <Button variant="ghost" size="sm" onClick={onDiscard} disabled={!dirty || saving}>Discard</Button>
      {canView ? (
        <Button variant="primary" size="sm" onClick={() => router.push(profileHref)}>View profile</Button>
      ) : (
        <Button variant="primary" size="sm" onClick={onSave} disabled={!dirty || saving || !nameValid}>{saving ? "Saving…" : "Save"}</Button>
      )}
    </div>
  );
}
