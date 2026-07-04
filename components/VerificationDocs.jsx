"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  MAX_VERIFICATION_DOCS,
  deleteVerificationDoc,
  docDisplayName,
  listVerificationDocs,
  uploadVerificationDoc,
} from "@/lib/supabase/storage";

// Supporting-documents uploader for the verification request card. One dashed
// zone is both the button (click -> hidden file input) and the drag-and-drop
// target. Files go client-direct to the PRIVATE `verification-docs` bucket
// (owner-scoped RLS, migration 0033); the folder listing is the only state, so
// there's nothing to save — uploads persist immediately, independent of the
// profile editor. Self-sufficient: resolves its own user id and renders
// nothing while logged out, so RequestVerification's call sites don't change.
export function VerificationDocs() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [userId, setUserId] = useState(null);
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState([]); // [{ name, message }]
  const [removing, setRemoving] = useState(null); // doc name being removed
  const inputRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data?.user?.id;
      if (!id || !mounted.current) return;
      setUserId(id);
      const list = await listVerificationDocs(supabase, id);
      if (mounted.current) setDocs(list);
    })();
    return () => { mounted.current = false; };
  }, [supabase]);

  if (!userId) return null;

  const full = docs.length >= MAX_VERIFICATION_DOCS;

  const addFiles = async (fileList) => {
    if (busy) return;
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setBusy(true);
    setErrors([]);
    const errs = [];
    let current = docs;
    for (const file of files) {
      if (current.length >= MAX_VERIFICATION_DOCS) {
        errs.push({ name: file.name, message: `Up to ${MAX_VERIFICATION_DOCS} documents.` });
        continue;
      }
      // The `accept` attribute doesn't apply to dropped files — the helper
      // re-validates type and size either way.
      const res = await uploadVerificationDoc(supabase, userId, file);
      if (!res.ok) {
        errs.push({ name: file.name, message: res.error });
        continue;
      }
      current = [...current, { name: res.name, path: res.path, size: file.size }];
      if (mounted.current) setDocs(current);
    }
    if (mounted.current) {
      setErrors(errs);
      setBusy(false);
    }
  };

  const remove = async (name) => {
    if (removing) return;
    setRemoving(name);
    setErrors([]);
    const res = await deleteVerificationDoc(supabase, userId, name);
    if (mounted.current) {
      if (res.ok) setDocs((d) => d.filter((doc) => doc.name !== name));
      else setErrors([{ name: docDisplayName(name), message: res.error }]);
      setRemoving(null);
    }
  };

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--desk)" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon name="paperclip" size={13} className="text-slate-500" />
        <h4 className="text-[12.5px] font-semibold text-slate-700">Supporting documents</h4>
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums">{docs.length}/{MAX_VERIFICATION_DOCS}</span>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || full}
        onDragOver={(e) => { e.preventDefault(); if (!busy && !full) setDragging(true); }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return; // ignore moves onto children
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy && !full) addFiles(e.dataTransfer.files);
        }}
        className="w-full flex flex-col items-center justify-center gap-1 px-3 py-4 transition-colors disabled:cursor-not-allowed"
        style={{
          border: `1.5px dashed ${dragging ? "var(--accent)" : "var(--paper-line)"}`,
          borderRadius: 10,
          background: dragging ? "var(--accent-softer)" : "var(--bg-soft)",
          color: "var(--ink)",
          cursor: busy || full ? "not-allowed" : "pointer",
          opacity: full && !busy ? 0.6 : 1,
        }}
      >
        <Icon name="upload" size={16} className={dragging ? "" : "text-slate-400"} />
        <span className="text-[12.5px] font-medium text-slate-700">
          {busy ? "Uploading…" : full ? "Document limit reached" : "Click to upload or drag files here"}
        </span>
        {!full && <span className="text-[11px] text-slate-400">WWCC, transcript, ID — PDF or image, 10 MB max</span>}
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
          addFiles(files);
        }}
      />

      {docs.length > 0 && (
        <ul className="mt-2 space-y-1">
          {docs.map((doc) => (
            <li
              key={doc.name}
              className="flex items-center gap-2 px-2.5 py-1.5 text-[12.5px]"
              style={{ background: "var(--bg-soft)", borderRadius: 8 }}
            >
              <Icon name={doc.name.toLowerCase().endsWith(".pdf") ? "file-text" : "image"} size={13} className="shrink-0 text-slate-400" />
              <span className="flex-1 min-w-0 truncate text-slate-700">{docDisplayName(doc.name)}</span>
              <button
                type="button"
                onClick={() => remove(doc.name)}
                disabled={removing === doc.name}
                title="Remove"
                className="shrink-0 inline-flex items-center justify-center text-slate-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                style={{ width: 20, height: 20 }}
              >
                <Icon name="trash" size={12.5} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {errors.map((err, i) => (
        <p key={i} className="mt-1.5 text-[12px]" style={{ color: "#DC2626" }}>
          <span className="font-medium">{err.name}:</span> {err.message}
        </p>
      ))}

      <p className="mt-2 text-[11.5px] text-slate-400 leading-[1.5]">
        Documents are only used for this review and are deleted as soon as your request is approved or rejected.
      </p>
    </div>
  );
}
