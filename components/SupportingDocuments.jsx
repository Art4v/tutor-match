"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { Button } from "./ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import {
  MAX_VERIFICATION_DOCS,
  listVerificationDocs,
  removeVerificationDoc,
  uploadVerificationDoc,
} from "@/lib/supabase/storage";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/gif";

// Private supporting documents on a verification request (0079). Files upload
// as soon as they are added. The state lives in this hook, owned by
// RequestVerification, so the profile card can show a count and an upload keeps
// running after its modal closes.
export function useSupportingDocs(enabled) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [uploading, setUploading] = useState([]); // [{ key, name }]
  const [removing, setRemoving] = useState([]); // doc ids
  const [errors, setErrors] = useState([]); // [{ name, message }]
  const [loadError, setLoadError] = useState("");
  const docCount = useRef(0);
  const inFlight = useRef(0);
  const nextKey = useRef(0);

  const refresh = useCallback(async () => {
    const res = await listVerificationDocs();
    if (res.ok) {
      setDocs(res.docs);
      docCount.current = res.docs.length;
      setLoadError("");
    } else {
      setLoadError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  const add = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const room = Math.max(0, MAX_VERIFICATION_DOCS - docCount.current - inFlight.current);
    const taken = files.slice(0, room).map((file) => ({ file, key: nextKey.current++ }));
    setErrors(files.slice(room).map((file) => ({ name: file.name, message: `Up to ${MAX_VERIFICATION_DOCS} documents.` })));
    if (taken.length === 0) return;

    inFlight.current += taken.length;
    setUploading((list) => [...list, ...taken.map(({ file, key }) => ({ key, name: file.name }))]);
    for (const { file, key } of taken) {
      const res = await uploadVerificationDoc(supabase, file);
      inFlight.current -= 1;
      setUploading((list) => list.filter((u) => u.key !== key));
      if (res.ok) {
        docCount.current += 1;
        setDocs((list) => [...list, { id: res.id, fileName: res.fileName, url: null }]);
      } else {
        setErrors((list) => [...list, { name: file.name, message: res.error }]);
      }
    }
    // A fresh listing gives the new files their links.
    if (inFlight.current === 0) await refresh();
  };

  const remove = async (doc) => {
    setErrors([]);
    setRemoving((list) => [...list, doc.id]);
    const res = await removeVerificationDoc(doc.id);
    setRemoving((list) => list.filter((id) => id !== doc.id));
    if (res.ok) {
      docCount.current -= 1;
      setDocs((list) => list.filter((d) => d.id !== doc.id));
    } else {
      setErrors([{ name: doc.fileName, message: res.error }]);
    }
  };

  return { docs, loading, uploading, removing, errors, loadError, add, remove, busy: uploading.length > 0 };
}

/** The upload zone and file list. `readOnly` while a request is under review. */
export function SupportingDocumentsPanel({ state, readOnly = false }) {
  const { docs, uploading, removing, errors, loadError, add, remove } = state;
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const full = docs.length + uploading.length >= MAX_VERIFICATION_DOCS;

  return (
    <div>
      {!readOnly && (
        <>
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
              if (!full) add(e.dataTransfer.files);
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
            {!full && <span className="text-[11px] text-slate-400">PDF, JPEG, PNG, WebP or GIF, 10 MB max</span>}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              // Snapshot first: e.target.files is a LIVE FileList, emptied by
              // the reset that lets the same file be picked again.
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              add(files);
            }}
          />
        </>
      )}

      {(docs.length > 0 || uploading.length > 0) && (
        <ul className="mt-2 space-y-1">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 px-2.5 py-1.5 text-[12.5px]" style={{ background: "var(--bg-soft)", borderRadius: 8 }}>
              <Icon name="file-text" size={13} className="shrink-0 text-slate-400" />
              {doc.url ? (
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate" style={{ color: "var(--accent)" }}>
                  {doc.fileName}
                </a>
              ) : (
                <span className="flex-1 min-w-0 truncate text-slate-700">{doc.fileName}</span>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => remove(doc)}
                  disabled={removing.includes(doc.id)}
                  title="Remove"
                  aria-label={`Remove ${doc.fileName}`}
                  className="shrink-0 inline-flex items-center justify-center text-slate-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                  style={{ width: 20, height: 20 }}
                >
                  <Icon name="trash" size={12.5} />
                </button>
              )}
            </li>
          ))}
          {uploading.map((u) => (
            <li key={u.key} className="flex items-center gap-2 px-2.5 py-1.5 text-[12.5px]" style={{ background: "var(--bg-soft)", borderRadius: 8 }}>
              <Icon name="clock" size={13} className="shrink-0 text-slate-400" />
              <span className="flex-1 min-w-0 truncate text-slate-500">{u.name}</span>
              <span className="shrink-0 text-[11px] text-slate-400">Uploading…</span>
            </li>
          ))}
        </ul>
      )}

      {loadError && <p className="mt-1.5 text-[12px]" style={{ color: "#DC2626" }}>{loadError}</p>}
      {errors.map((err, i) => (
        <p key={i} className="mt-1.5 text-[12px]" style={{ color: "#DC2626" }}>
          <span className="font-medium">{err.name}:</span> {err.message}
        </p>
      ))}
    </div>
  );
}

/** The profile card's version of the panel. */
export function SupportingDocumentsModal({ state, readOnly = false, onClose }) {
  useEffect(() => {
    lockScroll();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockScroll();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,30,30,0.5)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="supporting-docs-title"
      onClick={onClose}
    >
      <div
        className="bg-[color:var(--paper-card)] w-full overflow-y-auto"
        style={{ maxWidth: 480, maxHeight: "85vh", borderRadius: "var(--radius-card)", padding: 24, boxShadow: "0 24px 60px rgba(0,30,30,0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <h2 id="supporting-docs-title" className="text-[18px] font-light text-slate-800 tracking-tight">
            Supporting documentation
          </h2>
          <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
            {state.docs.length}/{MAX_VERIFICATION_DOCS}
          </span>
        </div>
        <p className="text-[13px] text-slate-500 mt-1 mb-4">
          {readOnly
            ? "These were sent with your request and can't be changed while it's under review."
            : "Only MatchTutor admins can see these. They're deleted once you're verified."}
        </p>
        <SupportingDocumentsPanel state={state} readOnly={readOnly} />
        <div className="flex justify-end mt-5">
          <Button variant="outline" size="md" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
