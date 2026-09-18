"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { saveCompanyTutor } from "@/lib/supabase/companies";
import { CompanyLogo } from "./CompanyCards";
import { CompanyTutorModal } from "./CompanyTutorModal";

/**
 * Manage the tutors a company lists.
 *
 * UNLIKE every other section in this editor, add and remove persist
 * IMMEDIATELY rather than on the enclosing Save. That is not an inconsistency:
 * adding a tutor mints a shadow auth user and removing one deletes it, and
 * neither can be held in a draft and replayed later. It is why this section is
 * mounted with `closeOnly` and gets a Done button rather than Cancel / Save.
 *
 * Field edits draft inside <CompanyTutorModal> and commit on its own button, so
 * abandoning one changes nothing here.
 *
 * ADDING IS TWO WRITES BEHIND ONE BUTTON: the route mints the shadow account
 * (it needs the service-role client, which the browser does not have), then the
 * browser saves the fields (that RPC authorises through auth.uid(), which the
 * service-role client does not have). Neither half can do both.
 *
 * Which makes `createdIdRef` load-bearing. If the first write lands and the
 * second fails, a real tutor exists with only a name, and pressing Save again
 * must NOT mint a second account. The ref is what makes the retry resume rather
 * than restart.
 */
export function CompanyTutorsEditor({
  companyId,
  companyVisibility = "public",
  ownerId,
  tutors,
  setTutors,
  supabase,
  subjectCatalog,
  onToast,
}) {
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null); // null | "new" | tutor
  const [saving, setSaving] = useState(false);
  const createdIdRef = useRef(null);

  // Subjects are held as slugs while editing and as objects everywhere else
  // (CompanyTutorsCard feeds these rows straight into the real <TutorCard>,
  // which expects objects), so resolve them back through the catalog on the way
  // out of the modal.
  const resolveSubjects = (slugs) =>
    (slugs ?? []).map((slug) => {
      const hit = (subjectCatalog ?? []).find((s) => s.slug === slug);
      return hit
        ? { name: hit.name, slug: hit.slug, exam: hit.exam ?? null }
        : { name: slug, slug, exam: null };
    });

  const submit = async (draft) => {
    if (saving) return;
    const name = (draft.name ?? "").trim();
    if (!name) return;
    setSaving(true);
    try {
      // Step 1, only for a tutor that does not exist yet. createdIdRef survives
      // a failed step 2, so a retry skips straight to the save.
      let id = draft.id ?? createdIdRef.current;
      let slug = draft.slug ?? null;
      const creating = !id;

      if (creating) {
        const res = await fetch("/api/companies/tutors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          onToast("error", data?.error || "Could not add that tutor.", 4000);
          return;
        }
        id = data.id;
        slug = data.slug;
        createdIdRef.current = id;
        // Append now, before the second write, so a tutor that exists in the
        // database is never missing from the list the owner is looking at.
        setTutors((prev) => [
          ...prev,
          {
            id,
            slug,
            name,
            bio: "",
            bioLong: "",
            avatarImg: null,
            avatarBg: null,
            initial: name.charAt(0).toUpperCase(),
            // provision_partner_tutor inherits the COMPANY's visibility, so a
            // hidden company's new tutor starts hidden too.
            visibility: companyVisibility,
            credentials: [],
            yearMin: 0,
            yearMax: 12,
            subjects: [],
          },
        ]);
      }

      // Step 2: everything else.
      const result = await saveCompanyTutor(supabase, id, draft);
      if (!result.ok) {
        onToast(
          "error",
          creating
            ? `${name} was added, but their details did not save. Press Add tutor to try again.`
            : result.error?.message || "Could not save that tutor.",
          5000
        );
        return;
      }

      const saved = {
        name,
        bio: draft.bio ?? "",
        bioLong: draft.bioLong ?? "",
        avatarImg: draft.avatarImg ?? null,
        avatarBg: draft.avatarBg ?? null,
        initial: draft.initial ?? name.charAt(0).toUpperCase(),
        credentials: draft.credentials ?? [],
        yearMin: draft.yearMin,
        yearMax: draft.yearMax,
        subjects: resolveSubjects(draft.subjects),
      };
      setTutors((prev) => prev.map((t) => (t.id === id ? { ...t, ...saved } : t)));

      if (result.droppedSubjects?.length > 0) {
        onToast("error", "Saved. Some subjects were not recognised and were skipped.", 4000);
      } else {
        onToast("ok", creating ? `${name} added.` : "Tutor saved", 1800);
      }
      createdIdRef.current = null;
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (saving) return;
    createdIdRef.current = null;
    setEditing(null);
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
      const res = await fetch("/api/companies/tutors", {
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
      onToast("ok", `${tutor.name} removed.`, 1800);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <p className="text-[13px] text-slate-500 mb-4">
        Tutors you list here appear on your page and in the main tutor search, each carrying your
        company&rsquo;s name. They don&rsquo;t get their own login, and students enquire through you.
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
                <CompanyLogo company={{ logoImg: t.avatarImg, avatarBg: t.avatarBg, initial: t.initial }} size={38} />
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
                  onClick={() => setEditing(t)}
                  className="shrink-0 text-[12.5px] font-medium px-3 py-1.5 transition-colors hover:bg-slate-100"
                  style={{ border: "1px solid var(--paper-line)", borderRadius: 999, color: "var(--ink)" }}
                >
                  Edit
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
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--desk)" }}>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:bg-slate-100"
          style={{ border: "1px solid var(--paper-line)", borderRadius: 999, padding: "9px 15px", color: "var(--ink)" }}
        >
          <Icon name="plus" size={14} /> Add tutor
        </button>
      </div>

      {editing && (
        // Keyed so reopening on a different tutor reseeds the draft rather than
        // reusing the last one's state.
        <CompanyTutorModal
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? null : editing}
          ownerId={ownerId}
          supabase={supabase}
          subjectCatalog={subjectCatalog}
          saving={saving}
          onCancel={cancelEdit}
          onSubmit={submit}
        />
      )}
    </div>
  );
}
