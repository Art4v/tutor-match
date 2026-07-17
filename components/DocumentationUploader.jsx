"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "./Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  MAX_TUTOR_DOCS,
  deleteTutorDoc,
  updateTutorDocTitle,
  uploadTutorDoc,
} from "@/lib/supabase/storage";

// Strip the extension for the title prefill — "WWCC.pdf" suggests "WWCC".
function titleFromFileName(fileName) {
  const raw = String(fileName || "");
  const dot = raw.lastIndexOf(".");
  return (dot > 0 ? raw.slice(0, dot) : raw).trim();
}

// Documentation editor — the form behind the profile's "Documentation" card.
// Draft-based like the other section editors: everything (new files, removals,
// renames) is staged locally and applied only when the modal's Save runs
// `commit()` (exposed via ref); Cancel just unmounts the draft. One dashed
// zone is both the button (click -> hidden file input) and the drag-and-drop
// target. Picking files first STAGES them behind the public-visibility
// warning panel — they join the draft only once the tutor confirms, and
// upload (to the PUBLIC `tutor-docs` bucket + a `tutor_documents` row,
// migration 0034) only on Save. `onDirtyChange` drives the Save button's
// enabled state in the parent.
export const DocumentationUploader = forwardRef(function DocumentationUploader(
  { userId, docs, onDirtyChange },
  ref
) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  // Existing docs, seeded once — the modal remounts on every open, so this is
  // always fresh. `removed` / `title` edits stay draft-only until commit().
  const [items, setItems] = useState(() =>
    docs.map((d) => ({ ...d, originalTitle: d.title, removed: false }))
  );
  const [added, setAdded] = useState([]); // [{ key, file, title }] — upload on Save
  const [pending, setPending] = useState([]); // [{ file, title }] awaiting the warning confirm
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState([]); // [{ name, message }]
  const [editingKey, setEditingKey] = useState(null); // row being retitled (doc id or added key)
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef(null);
  const addedKey = useRef(0);

  const visibleItems = items.filter((it) => !it.removed);
  const count = visibleItems.length + added.length;
  const full = count + pending.length >= MAX_TUTOR_DOCS;

  const dirty =
    added.length > 0 ||
    items.some((it) => it.removed || it.title.trim() !== it.originalTitle);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  // Applies the draft: removals first (frees cap room), then renames, then
  // uploads. Partial failures are collected, not fatal — the parent shows a
  // warn toast and the returned list reflects what actually persisted.
  useImperativeHandle(ref, () => ({
    async commit() {
      const errs = [];
      const finalDocs = [];
      for (const it of items) {
        if (it.removed) {
          const res = await deleteTutorDoc(supabase, it.id, it.path);
          if (!res.ok) {
            errs.push({ name: it.originalTitle, message: res.error });
            finalDocs.push({ id: it.id, title: it.originalTitle, path: it.path, url: it.url });
          }
          continue;
        }
        let title = it.title.trim() || it.originalTitle;
        if (title !== it.originalTitle) {
          const res = await updateTutorDocTitle(supabase, it.id, title);
          if (!res.ok) {
            errs.push({ name: it.originalTitle, message: res.error });
            title = it.originalTitle;
          }
        }
        finalDocs.push({ id: it.id, title, path: it.path, url: it.url });
      }
      for (const a of added) {
        if (finalDocs.length >= MAX_TUTOR_DOCS) {
          errs.push({ name: a.file.name, message: `Up to ${MAX_TUTOR_DOCS} documents.` });
          continue;
        }
        // The `accept` attribute doesn't apply to dropped files — the helper
        // re-validates type and size either way.
        const res = await uploadTutorDoc(supabase, userId, a.file, a.title);
        if (!res.ok) {
          errs.push({ name: a.file.name, message: res.error });
          continue;
        }
        finalDocs.push({ id: res.id, title: res.title, path: res.path, url: res.url });
      }
      return { docs: finalDocs, errors: errs };
    },
  }));

  const stage = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setErrors([]);
    const room = Math.max(0, MAX_TUTOR_DOCS - count - pending.length);
    const taken = files.slice(0, room);
    setErrors(files.slice(room).map((file) => ({ name: file.name, message: `Up to ${MAX_TUTOR_DOCS} documents.` })));
    if (taken.length > 0) {
      setPending((p) => [...p, ...taken.map((file) => ({ file, title: titleFromFileName(file.name) }))]);
    }
  };

  const confirmAdd = () => {
    setAdded((a) => [...a, ...pending.map((item) => ({ ...item, key: `new-${addedKey.current++}` }))]);
    setPending([]);
  };

  const startRetitle = (key, current) => {
    setEditingKey(key);
    setEditValue(current);
  };

  const commitRetitle = (key) => {
    const next = editValue.trim();
    setEditingKey(null);
    if (!next) return;
    setItems((list) => list.map((it) => (it.id === key ? { ...it, title: next } : it)));
    setAdded((list) => list.map((a) => (a.key === key ? { ...a, title: next } : a)));
  };

  // One row shape for existing + staged-new entries; draft-only actions.
  const row = ({ key, title, isPdf, isNew, onRemove }) => (
    <li
      key={key}
      className="flex items-center gap-2 px-2.5 py-1.5 text-[12.5px]"
      style={{ background: "var(--bg-soft)", borderRadius: 8 }}
    >
      <Icon name={isPdf ? "file-text" : "image"} size={13} className="shrink-0 text-slate-400" />
      {editingKey === key ? (
        <input
          type="text"
          autoFocus
          value={editValue}
          aria-label="Document title"
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => commitRetitle(key)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur(); // commit via onBlur
            if (e.key === "Escape") { setEditValue(""); setEditingKey(null); }
          }}
          className="flex-1 min-w-0 px-1.5 py-0.5 text-[12.5px] text-slate-700 bg-white"
          style={{ border: "1px solid var(--paper-line)", borderRadius: 6, outline: "none" }}
        />
      ) : (
        <span className="flex-1 min-w-0 truncate text-slate-700">{title}</span>
      )}
      {isNew && editingKey !== key && (
        <span
          className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={{ background: "var(--accent-softer)", border: "1px solid var(--accent-line)", borderRadius: 999, color: "var(--accent)" }}
        >
          New
        </span>
      )}
      <button
        type="button"
        onClick={() => startRetitle(key, title)}
        disabled={editingKey === key}
        title="Rename"
        className="shrink-0 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-50 transition-colors"
        style={{ width: 20, height: 20 }}
      >
        <Icon name="pencil" size={12} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="Remove"
        className="shrink-0 inline-flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors"
        style={{ width: 20, height: 20 }}
      >
        <Icon name="trash" size={12.5} />
      </button>
    </li>
  );

  return (
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-[18px] font-light text-slate-800 tracking-tight">Documentation</h2>
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{count}/{MAX_TUTOR_DOCS}</span>
      </div>
      <p className="text-[13px] text-slate-500 mt-1 mb-5">
        Documents that back up your credentials, like your WWCC, transcripts and certificates. They show publicly on your profile.
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={full}
        onDragOver={(e) => { e.preventDefault(); if (!full) setDragging(true); }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return; // ignore moves onto children
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!full) stage(e.dataTransfer.files);
        }}
        className="w-full flex flex-col items-center justify-center gap-1 px-3 py-4 transition-colors disabled:cursor-not-allowed"
        style={{
          border: `1.5px dashed ${dragging ? "var(--accent)" : "var(--paper-line)"}`,
          borderRadius: 10,
          background: dragging ? "var(--accent-softer)" : "var(--bg-soft)",
          color: "var(--ink)",
          cursor: full ? "not-allowed" : "pointer",
          opacity: full ? 0.6 : 1,
        }}
      >
        <Icon name="upload" size={16} className={dragging ? "" : "text-slate-400"} />
        <span className="text-[12.5px] font-medium text-slate-700">
          {full ? "Document limit reached" : "Click to upload or drag files here"}
        </span>
        {!full && <span className="text-[11px] text-slate-400">WWCC, transcript or certificate. PDF or image, 10 MB max</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          // Snapshot first: e.target.files is a LIVE FileList — clearing the
          // input's value empties it, so copying must happen before the reset.
          const files = Array.from(e.target.files || []);
          e.target.value = ""; // let the same file be re-picked after a remove
          stage(files);
        }}
      />

      {pending.length > 0 && (
        <div className="mt-3 px-3.5 py-3" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10 }}>
          <p className="text-[12.5px] leading-[1.55] flex items-start gap-2" style={{ color: "#92400E" }}>
            <span className="shrink-0 mt-0.5"><Icon name="alert-triangle" size={14} /></span>
            <span>
              <strong>These documents will be public.</strong> Anyone who views your profile can open and
              download them. Don&apos;t upload anything you need to keep private, like photo ID.
            </span>
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {pending.map((item, i) => (
              <li key={`${item.file.name}-${i}`} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.title}
                  placeholder="Title shown on your profile"
                  aria-label={`Title for ${item.file.name}`}
                  onChange={(e) => setPending((p) => p.map((x, xi) => (xi === i ? { ...x, title: e.target.value } : x)))}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-[12.5px] text-slate-700 bg-white"
                  style={{ border: "1px solid #FDE68A", borderRadius: 8, outline: "none" }}
                />
                <span className="shrink-0 max-w-[120px] truncate text-[11px] text-slate-400">{item.file.name}</span>
                <button
                  type="button"
                  onClick={() => setPending((p) => p.filter((_, xi) => xi !== i))}
                  title="Don't add this file"
                  className="shrink-0 inline-flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors"
                  style={{ width: 20, height: 20 }}
                >
                  <Icon name="x" size={12} />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setPending([])}
              className="px-3 py-1.5 text-[12.5px] font-medium rounded-full transition-colors hover:bg-white/60"
              style={{ color: "#92400E", border: "1px solid #FDE68A", background: "transparent" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmAdd}
              className="px-3 py-1.5 text-[12.5px] font-medium rounded-full transition-colors inline-flex items-center gap-1.5"
              style={{ background: "var(--ink)", color: "#fff" }}
            >
              <Icon name="check" size={12.5} strokeWidth={2.4} />
              Add {pending.length === 1 ? "1 file" : `${pending.length} files`}
            </button>
          </div>
        </div>
      )}

      {(visibleItems.length > 0 || added.length > 0) && (
        <ul className="mt-2 space-y-1">
          {visibleItems.map((it) =>
            row({
              key: it.id,
              title: it.title,
              isPdf: it.path.toLowerCase().endsWith(".pdf"),
              isNew: false,
              onRemove: () => setItems((list) => list.map((x) => (x.id === it.id ? { ...x, removed: true } : x))),
            })
          )}
          {added.map((a) =>
            row({
              key: a.key,
              title: a.title || titleFromFileName(a.file.name) || a.file.name,
              isPdf: a.file.name.toLowerCase().endsWith(".pdf"),
              isNew: true,
              onRemove: () => setAdded((list) => list.filter((x) => x.key !== a.key)),
            })
          )}
        </ul>
      )}

      {errors.map((err, i) => (
        <p key={i} className="mt-1.5 text-[12px]" style={{ color: "#DC2626" }}>
          <span className="font-medium">{err.name}:</span> {err.message}
        </p>
      ))}

      <p className="mt-2 text-[11.5px] text-slate-400 leading-[1.5]">
        Nothing changes until you save. Save uploads new files and applies removals and renames.
      </p>
    </div>
  );
});
