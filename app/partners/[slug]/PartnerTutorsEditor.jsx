"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { SubjectPicker } from "@/components/SubjectPicker";
import { Field, TextInput, RichTextField, ImageUploadControl } from "@/components/profile-edit/sections";
import { savePartnerTutor } from "@/lib/supabase/partners";
import { PartnerLogo } from "./PartnerCards";

/**
 * Manage the tutors a centre lists.
 *
 * UNLIKE every other section in this editor, add and remove persist
 * IMMEDIATELY rather than on Save. That is not an inconsistency: adding a tutor
 * mints a shadow auth user and removing one deletes it, and neither can be held
 * in a draft and replayed later. It is the same reason ArticleEditor uploads a
 * cover immediately while the rest of the article drafts (Storage can't ride a
 * row upsert). Per-tutor field edits DO draft, and save on their own Save
 * button, because those are ordinary row updates.
 */
export function PartnerTutorsEditor({ partnerId, ownerId, tutors, setTutors, supabase, subjectCatalog, onToast }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null);

  const add = async () => {
    const name = newName.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/partners/tutors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast("error", data?.error || "Could not add that tutor.", 4000);
        return;
      }
      setTutors([
        ...tutors,
        {
          id: data.id,
          slug: data.slug,
          name: data.name,
          bio: "",
          avatarImg: null,
          avatarBg: null,
          initial: name.charAt(0).toUpperCase(),
          visibility: "public",
          subjects: [],
        },
      ]);
      setNewName("");
      onToast("ok", `${name} added.`, 1800);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (tutor) => {
    if (busyId) return;
    // Destructive and irreversible: the shadow account is deleted outright, not
    // hidden, so the profile and its URL are gone for good.
    const ok = window.confirm(
      `Remove ${tutor.name}? Their profile and its page are deleted permanently. This can't be undone.`
    );
    if (!ok) return;
    setBusyId(tutor.id);
    try {
      const res = await fetch("/api/partners/tutors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorId: tutor.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast("error", data?.error || "Could not remove that tutor.", 4000);
        return;
      }
      setTutors(tutors.filter((t) => t.id !== tutor.id));
      if (openId === tutor.id) setOpenId(null);
      onToast("ok", `${tutor.name} removed.`, 1800);
    } finally {
      setBusyId(null);
    }
  };

  const patch = (id, p) => setTutors(tutors.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const saveOne = async (tutor) => {
    if (busyId) return;
    setBusyId(tutor.id);
    try {
      const result = await savePartnerTutor(supabase, tutor.id, tutor);
      if (!result.ok) {
        onToast("error", result.error?.message || "Could not save that tutor.", 4000);
        return;
      }
      setOpenId(null);
      onToast("ok", "Tutor saved", 1600);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <p className="text-[13px] text-slate-500 mb-4">
        Tutors you list here appear on your page and in the main tutor search, each carrying your
        centre&rsquo;s name. They don&rsquo;t get their own login, and students enquire through you.
      </p>

      {tutors.length === 0 ? (
        <div
          className="text-[13.5px] text-slate-500 py-4 px-4 text-center"
          style={{ background: "var(--bg-soft)", borderRadius: 10 }}
        >
          No tutors yet. Add your first one below.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {tutors.map((t) => (
            <li key={t.id} style={{ border: "1px solid var(--paper-line)", borderRadius: 12 }}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <PartnerLogo partner={{ logoImg: t.avatarImg, avatarBg: t.avatarBg, initial: t.initial }} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium truncate" style={{ color: "var(--ink)" }}>
                    {t.name}
                  </div>
                  <div className="text-[12.5px] text-slate-500 truncate">
                    {t.subjects.length > 0
                      ? t.subjects.map((s) => s.name ?? s).slice(0, 3).join(", ")
                      : "No subjects yet"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(openId === t.id ? null : t.id)}
                  className="shrink-0 text-[12.5px] font-medium px-3 py-1.5 transition-colors hover:bg-slate-100"
                  style={{ border: "1px solid var(--paper-line)", borderRadius: 999, color: "var(--ink)" }}
                >
                  {openId === t.id ? "Close" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(t)}
                  disabled={busyId === t.id}
                  aria-label={`Remove ${t.name}`}
                  className="shrink-0 inline-flex items-center justify-center transition-colors hover:bg-slate-100 disabled:opacity-50"
                  style={{ width: 32, height: 32, borderRadius: 999, color: "var(--ink-muted)", border: "1px solid var(--paper-line)" }}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>

              {openId === t.id && (
                <div className="px-3 pb-3.5 pt-1 space-y-4" style={{ borderTop: "1px solid var(--desk)" }}>
                  <Field label="Name">
                    <TextInput
                      value={t.name}
                      onChange={(v) => patch(t.id, { name: v, initial: v.trim().charAt(0).toUpperCase() || null })}
                      placeholder="Jane Liu"
                      maxLength={80}
                    />
                  </Field>

                  <ImageUploadControl
                    label="Photo"
                    value={t.avatarImg}
                    kind="avatar"
                    supabase={supabase}
                    // The PARTNER OWNER's uid, not the tutor's. The
                    // profile-images bucket policy (0006) is owner-by-uid-folder
                    // and checks auth.uid() against the first path segment, so
                    // uploading under the tutor's id would be rejected by
                    // Storage — silently, since the crop modal only surfaces a
                    // generic failure. The bucket is public, so the file being
                    // in the centre's folder costs nothing on read.
                    userId={ownerId}
                    onChange={(url) => patch(t.id, { avatarImg: url })}
                    hint="Optional. A head-and-shoulders photo works best."
                    aspect={1}
                    cropShape="round"
                    maxOutputPx={1024}
                  />

                  <Field label="Tagline" optional hint="One line, shown under their name.">
                    <TextInput
                      value={t.bio ?? ""}
                      onChange={(v) => patch(t.id, { bio: v })}
                      placeholder="HSC Chemistry and Biology specialist."
                      maxLength={140}
                    />
                  </Field>

                  <Field label="About" optional>
                    <RichTextField
                      value={t.bioLong ?? ""}
                      onChange={(v) => patch(t.id, { bioLong: v })}
                      placeholder="A few sentences about how they teach…"
                      rows={5}
                      maxLength={1200}
                      lists
                    />
                  </Field>

                  <Field label="Subjects" hint="What this tutor teaches. Students filter by these.">
                    <SubjectPicker
                      catalog={subjectCatalog}
                      value={t.subjects.map((s) => s.slug ?? s)}
                      onChange={(slugs) => patch(t.id, { subjects: slugs })}
                    />
                  </Field>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => saveOne(t)}
                      disabled={busyId === t.id || (t.name ?? "").trim() === ""}
                      className="px-3.5 py-1.5 text-[12.5px] font-medium rounded-full inline-flex items-center gap-1.5 disabled:opacity-60"
                      style={{ background: "var(--ink)", color: "#fff" }}
                    >
                      {busyId === t.id ? "Saving…" : (<><Icon name="check" size={13} strokeWidth={2.4} /> Save tutor</>)}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2.5 mt-4 pt-4" style={{ borderTop: "1px solid var(--desk)" }}>
        <div className="flex-1 min-w-0">
          <Field label="Add a tutor">
            <TextInput
              value={newName}
              onChange={setNewName}
              placeholder="Their full name"
              maxLength={80}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={adding || newName.trim() === ""}
          className="shrink-0 mb-1 inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:bg-slate-100 disabled:opacity-50"
          style={{ border: "1px solid var(--paper-line)", borderRadius: 999, padding: "9px 15px", color: "var(--ink)" }}
        >
          <Icon name="plus" size={14} /> {adding ? "Adding…" : "Add"}
        </button>
      </div>
    </div>
  );
}
