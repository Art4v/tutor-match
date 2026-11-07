"use client";

// Optional signup materials for an invited tutor (0076): up to 5 documents
// (resumes, certificates) and up to 5 links. PRIVATE: only MatchTutor admins
// see them, as source material for the profile. Sent once; Skip sends nothing.
// Files upload only when Send is pressed. A file that uploads and is then not
// sent (a failed send, a later Skip) is swept by /api/join/materials once the
// tutor sends or skips, and by opt-out; a retry reuses what already uploaded.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { uploadInviteMaterial, inviteDocFileError, INVITE_DOC_TYPES } from "@/lib/supabase/storage";
import { MAX_INVITE_DOCS, MAX_INVITE_LINKS, MAX_LINK_LENGTH } from "@/lib/tutorInvite";

const titleFromName = (name) => String(name || "").replace(/\.[^.]+$/, "").slice(0, 200) || "Document";

export default function InviteMaterialsForm() {
  const router = useRouter();
  const [files, setFiles] = useState([]); // [{ file, title, path? }]; path once uploaded
  const [links, setLinks] = useState([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const addFiles = (list) => {
    setError(null);
    const picked = Array.from(list ?? []);
    const next = [...files];
    for (const file of picked) {
      if (next.length >= MAX_INVITE_DOCS) {
        setError(`You can attach up to ${MAX_INVITE_DOCS} documents.`);
        break;
      }
      const invalid = inviteDocFileError(file);
      if (invalid) {
        setError(invalid);
        continue;
      }
      next.push({ file, title: titleFromName(file.name) });
    }
    setFiles(next);
  };

  // People paste "linkedin.com/in/you", so a link with no scheme gets https://.
  // The server still enforces ^https?://, so this only ever adds a prefix.
  const withScheme = (l) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(l) ? l : `https://${l.replace(/^\/+/, "")}`);
  const cleanLinks = () => links.map((l) => l.trim()).filter(Boolean).map(withScheme);

  const send = async (skip) => {
    setError(null);
    const finalLinks = skip ? [] : cleanLinks();
    if (!skip) {
      const bad = finalLinks.find((l) => !/^https?:\/\/\S+$/i.test(l) || l.length > MAX_LINK_LENGTH);
      if (bad) return setError(`Check your links. They can't contain spaces or be longer than ${MAX_LINK_LENGTH} characters.`);
      if (files.some((f) => !f.title.trim())) return setError("Give each document a title.");
    }

    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const docs = [];
    if (!skip) {
      // Remember each upload on its entry, so a retry after a failure (here
      // or in the POST below) reuses it instead of uploading it again.
      const uploaded = [...files];
      for (let i = 0; i < uploaded.length; i++) {
        const entry = uploaded[i];
        if (!entry.path) {
          const up = await uploadInviteMaterial(supabase, entry.file);
          if (!up.ok) {
            setFiles(uploaded);
            setBusy(false);
            return setError(`${entry.file.name}: ${up.error}`);
          }
          uploaded[i] = { ...entry, path: up.path };
        }
        docs.push({ path: uploaded[i].path, title: entry.title.trim() });
      }
      setFiles(uploaded);
    }

    try {
      const res = await fetch("/api/join/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docs, links: finalLinks }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setBusy(false);
        return setError(payload?.error ?? "Could not send your documents. Please try again.");
      }
    } catch {
      setBusy(false);
      return setError("Could not send your documents. Please try again.");
    }
    router.push("/profile");
    router.refresh();
  };

  return (
    <div
      className="w-full max-w-[520px] bg-[color:var(--paper-card)]"
      style={{
        border: "1px solid var(--paper-line)",
        borderRadius: "var(--radius-card)",
        padding: 32,
        boxShadow: "0 30px 80px -40px rgba(0,30,30,0.18)",
      }}
    >
      <h1 className="text-[36px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}>
        Help us build your profile.
      </h1>
      <p className="text-[14px] text-slate-500 mt-2 leading-[1.55]">
        Attach anything that helps us set up your profile, like a resume or certificates, and links such as
        LinkedIn or a portfolio. Only the MatchTutor team can see these. Everything here is optional, and you
        can only send it once.
      </p>

      <section className="mt-6">
        <div className="text-[12.5px] font-medium text-slate-900 uppercase tracking-wider mb-2.5">
          Documents ({files.length}/{MAX_INVITE_DOCS})
        </div>
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <Icon name="file-text" size={16} />
              <input
                value={f.title}
                onChange={(e) => setFiles(files.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                maxLength={200}
                aria-label={`Title for ${f.file.name}`}
                className="flex-1 h-9 px-3 text-[14px] text-slate-900 outline-none"
                style={{ border: "1px solid var(--paper-line)", borderRadius: 8, background: "var(--paper-card)" }}
              />
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                aria-label={`Remove ${f.file.name}`}
                className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <Icon name="x" size={16} />
              </button>
            </li>
          ))}
        </ul>
        {files.length < MAX_INVITE_DOCS && (
          <label
            className="mt-2 flex items-center justify-center gap-2 h-11 cursor-pointer text-[13.5px] font-medium"
            style={{ border: "1px dashed var(--paper-line)", borderRadius: 10, color: "var(--accent)" }}
          >
            <Icon name="upload" size={16} />
            Add PDF or image (10 MB max)
            <input
              type="file"
              accept={INVITE_DOC_TYPES.join(",")}
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </section>

      <section className="mt-6">
        <div className="text-[12.5px] font-medium text-slate-900 uppercase tracking-wider mb-2.5">Links</div>
        <div className="space-y-2">
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="url"
                value={link}
                onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="https://www.linkedin.com/in/you"
                maxLength={MAX_LINK_LENGTH}
                className="flex-1 h-9 px-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none"
                style={{ border: "1px solid var(--paper-line)", borderRadius: 8, background: "var(--paper-card)" }}
              />
              {links.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((_, j) => j !== i))}
                  aria-label="Remove link"
                  className="h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {links.length < MAX_INVITE_LINKS && (
          <button
            type="button"
            onClick={() => setLinks([...links, ""])}
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium"
            style={{ color: "var(--accent)" }}
          >
            <Icon name="plus" size={14} /> Add another link
          </button>
        )}
      </section>

      {error && (
        <div className="mt-5 px-3 py-2 text-[13px] text-red-700" style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5">
        <Button type="button" variant="outline" size="lg" full disabled={busy} onClick={() => send(true)}>
          Skip
        </Button>
        <Button type="button" variant="primary" size="lg" full disabled={busy} onClick={() => send(false)}>
          {busy ? "Sending…" : "Send to MatchTutor"}
        </Button>
      </div>
      <p className="text-[12px] text-slate-500 mt-3 text-center">
        Skipping is final too, so send anything you have now.
      </p>
    </div>
  );
}
