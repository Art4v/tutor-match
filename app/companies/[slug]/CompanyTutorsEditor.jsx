"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Avatar, Button } from "@/components/ui";
import { saveCompanyTutor } from "@/lib/supabase/companies";
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
            // Matches companyTutorRowToCard, so the card drops its per-hour
            // tile before the next reload too.
            isCompanyTutor: true,
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
      <p className="mb-4 text-[14px] leading-5 text-[color:var(--text-2)]">
        Tutors you list here appear on your page and in the main tutor search, each carrying your
        company&rsquo;s name. They don&rsquo;t get their own login, and students enquire through you.
      </p>

      {tutors.length === 0 ? (
        <p className="text-[14px] leading-5 text-[color:var(--text-2)]">No tutors yet.</p>
      ) : (
        // Ruled rows, no boxes. Tutors are people, so their photos are circles
        // (Avatar), never the square company logo.
        <ul className="border-t border-rule">
          {tutors.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-b border-rule py-3">
              <Avatar tutor={{ avatarImg: t.avatarImg, name: t.name }} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] leading-5 font-semibold text-[color:var(--text)]">{t.name}</div>
                <div className="truncate text-[12px] leading-4 text-muted">
                  {t.subjects.length > 0
                    ? t.subjects.map((s) => s.name ?? s).slice(0, 3).join(", ")
                    : "No subjects yet"}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(t)}>Edit</Button>
              <button
                type="button"
                onClick={() => remove(t)}
                disabled={busyId === t.id}
                aria-label={`Remove ${t.name}`}
                title="Remove"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2 hover:text-error disabled:opacity-50"
                style={{ transition: "background-color 120ms ease-out, color 120ms ease-out" }}
              >
                <Icon name="trash" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Button variant="outline" onClick={() => setEditing("new")}>Add tutor</Button>
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
