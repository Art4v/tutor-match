"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  MAX_TUTOR_DOCS,
  deleteTutorDoc,
  updateTutorDocTitle,
  uploadStagedDoc,
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
// `commit()` (exposed via ref); Cancel just unmounts the draft. One plain
// "Add files" button opens the hidden file input; files can also be dropped
// onto the editor. Picking files first STAGES them behind the public-visibility
// warning panel — they join the draft only once the tutor confirms, and
// upload (to the PUBLIC `tutor-docs` bucket + a `tutor_documents` row,
// migration 0034) only on Save. `onDirtyChange` drives the Save button's
// enabled state in the parent.
//
// mode="draft" is for verified tutors, whose documents change only through a
// reviewed draft (0072): commit() writes nothing live. It uploads new files to
// the PRIVATE staging bucket and returns the resulting list
// ([{ id | null, title, path, stagedPath, url }]) for the parent to save into
// the draft. Items may then be staged files (id null, stagedPath set).
//
// `ops` (live mode only) replaces the three live writes. The admin editor of
// a managed tutor (0076) passes ops that go through /api/admin routes, since
// an admin cannot write another tutor's documents with their own session.
// Each op resolves like the storage helper it replaces:
//   remove(item) -> { ok, error }, rename(item, title) -> { ok, error },
//   upload(file, title) -> { ok, id, title, path, url } | { ok: false, error }
export const DocumentationUploader = forwardRef(function DocumentationUploader(
  { userId, docs, onDirtyChange, mode = "live", ops, hideTitle = false },
  ref
) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const live = ops ?? {
    remove: (it) => deleteTutorDoc(supabase, it.id, it.path),
    rename: (it, title) => updateTutorDocTitle(supabase, it.id, title),
    upload: (file, title) => uploadTutorDoc(supabase, userId, file, title),
  };
  // Existing docs, seeded once — the modal remounts on every open, so this is
  // always fresh. `removed` / `title` edits stay draft-only until commit().
  const [items, setItems] = useState(() =>
    docs.map((d) => ({ ...d, key: d.id ?? d.stagedPath, originalTitle: d.title, removed: false }))
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
      if (mode === "draft") return commitDraft();
      const errs = [];
      const finalDocs = [];
      for (const it of items) {
        if (it.removed) {
          const res = await live.remove(it);
          if (!res.ok) {
            errs.push({ name: it.originalTitle, message: res.error });
            finalDocs.push({ id: it.id, title: it.originalTitle, path: it.path, url: it.url });
          }
          continue;
        }
        let title = it.title.trim() || it.originalTitle;
        if (title !== it.originalTitle) {
          const res = await live.rename(it, title);
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
        const res = await live.upload(a.file, a.title);
        if (!res.ok) {
          errs.push({ name: a.file.name, message: res.error });
          continue;
        }
        finalDocs.push({ id: res.id, title: res.title, path: res.path, url: res.url });
      }
      return { docs: finalDocs, errors: errs };
    },
  }));

  // Draft mode: nothing live is touched. Removed and renamed items are just
  // reflected in the returned list; new files go to private staging.
  const commitDraft = async () => {
    const errs = [];
    const finalDocs = items
      .filter((it) => !it.removed)
      .map((it) => ({
        id: it.id ?? null,
        title: it.title.trim() || it.originalTitle,
        path: it.path ?? "",
        stagedPath: it.stagedPath ?? null,
        url: it.url ?? null,
      }));
    for (const a of added) {
      if (finalDocs.length >= MAX_TUTOR_DOCS) {
        errs.push({ name: a.file.name, message: `Up to ${MAX_TUTOR_DOCS} documents.` });
        continue;
      }
      const res = await uploadStagedDoc(supabase, userId, a.file);
      if (!res.ok) {
        errs.push({ name: a.file.name, message: res.error });
        continue;
      }
      finalDocs.push({
        id: null,
        title: (a.title || "").trim() || titleFromFileName(a.file.name) || a.file.name,
        path: "",
        stagedPath: res.path,
        url: res.url,
      });
    }
    return { docs: finalDocs, errors: errs };
  };

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
    setItems((list) => list.map((it) => (it.key === key ? { ...it, title: next } : it)));
    setAdded((list) => list.map((a) => (a.key === key ? { ...a, title: next } : a)));
  };

  const iconBtn =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2 hover:text-[color:var(--text)] disabled:opacity-50";
  const iconBtnStyle = { transition: "background-color 120ms ease-out, color 120ms ease-out" };

  // One row shape for existing + staged-new entries; draft-only actions. A
  // plain ruled row (DESIGN.md: lists are rows divided by rules).
  const row = ({ key, title, isPdf, isNew, onRemove }) => (
    <li key={key} className="flex min-h-11 items-center gap-2 border-b border-rule py-2 text-[14px] leading-5">
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
          className="h-11 min-w-0 flex-1 rounded border border-input bg-surface px-3 text-[14px] leading-5 text-[color:var(--text)] focus:border-accent"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-[color:var(--text)]">{title}</span>
      )}
      {editingKey !== key && (
        <span className="shrink-0 text-[12px] leading-4 text-muted">
          {isPdf ? "PDF" : "Image"}{isNew ? ", new" : ""}
        </span>
      )}
      <button
        type="button"
        onClick={() => startRetitle(key, title)}
        disabled={editingKey === key}
        aria-label={`Rename ${title}`}
        title="Rename"
        className={iconBtn}
        style={iconBtnStyle}
      >
        <Icon name="pencil" size={16} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${title}`}
        title="Remove"
        className={iconBtn + " hover:text-error"}
        style={iconBtnStyle}
      >
        <Icon name="trash" size={16} />
      </button>
    </li>
  );

  return (
    <div
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
    >
      {!hideTitle && <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">Documents</h2>}
      <p className={(hideTitle ? "" : "mt-1 ") + "text-[14px] leading-5 text-[color:var(--text-2)]"}>
        Documents that back up your credentials, like your WWCC, transcripts and certificates. They show publicly on your profile.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={full}
          className={
            "inline-flex h-11 items-center rounded border px-4 text-[14px] leading-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50 " +
            (dragging ? "border-accent bg-surface-2 text-[color:var(--text)]" : "border-input bg-surface text-[color:var(--text)] hover:bg-surface-2")
          }
          style={{ transition: "background-color 120ms ease-out, border-color 120ms ease-out" }}
        >
          {full ? "Document limit reached" : "Add files"}
        </button>
        <span className="text-[12px] leading-4 text-muted">
          PDF or image, 10 MB max. {count} of {MAX_TUTOR_DOCS} used.
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          // Snapshot first: e.target.files is a LIVE FileList, and clearing the
          // input's value empties it, so copying must happen before the reset.
          const files = Array.from(e.target.files || []);
          e.target.value = ""; // let the same file be re-picked after a remove
          stage(files);
        }}
      />

      {pending.length > 0 && (
        // The one inline alert on this screen (DESIGN.md §1): a 1px warning
        // border, no tint.
        <div className="mt-4 rounded border border-warning px-4 py-3">
          <p className="flex items-start gap-2 text-[14px] leading-5 text-[color:var(--text)]">
            <span className="flex h-5 shrink-0 items-center text-warning"><Icon name="alert-triangle" size={16} /></span>
            <span>
              <strong>These documents will be public.</strong> Anyone who views your profile can open and
              download them. Don&apos;t upload anything you need to keep private, like photo ID.
            </span>
          </p>
          <ul className="mt-3 space-y-2">
            {pending.map((item, i) => (
              <li key={`${item.file.name}-${i}`}>
                <label className="block">
                  <span className="mb-2 block truncate text-[12px] leading-4 text-muted">Title for {item.file.name}</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => setPending((p) => p.map((x, xi) => (xi === i ? { ...x, title: e.target.value } : x)))}
                      className="h-11 min-w-0 flex-1 rounded border border-input bg-surface px-3 text-[14px] leading-5 text-[color:var(--text)] focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setPending((p) => p.filter((_, xi) => xi !== i))}
                      aria-label={`Don't add ${item.file.name}`}
                      title="Don't add this file"
                      className={iconBtn + " hover:text-error"}
                      style={iconBtnStyle}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setPending([])}>Cancel</Button>
            <Button variant="primary" onClick={confirmAdd}>
              Add {pending.length === 1 ? "1 file" : `${pending.length} files`}
            </Button>
          </div>
        </div>
      )}

      {(visibleItems.length > 0 || added.length > 0) && (
        <ul className="mt-4 border-t border-rule">
          {visibleItems.map((it) =>
            row({
              key: it.key,
              title: it.title,
              isPdf: (it.path || it.stagedPath || "").toLowerCase().endsWith(".pdf"),
              isNew: false,
              onRemove: () => setItems((list) => list.map((x) => (x.key === it.key ? { ...x, removed: true } : x))),
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
        <p key={i} className="mt-2 text-[14px] leading-5 text-error">
          <span className="font-semibold">{err.name}:</span> {err.message}
        </p>
      ))}

      <p className="mt-4 text-[12px] leading-4 text-muted">
        {mode === "draft"
          ? "Nothing changes until you save. Saved changes go into your draft and show on your profile once approved."
          : "Nothing changes until you save. Saving uploads new files and applies removals and renames."}
      </p>
    </div>
  );
});
