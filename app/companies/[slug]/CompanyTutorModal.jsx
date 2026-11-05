"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/Modal";
import {
  Field,
  TextInput,
  RichTextField,
  ImageUploadControl,
  SubjectsSection,
  YearLevelsSection,
  CredentialsSection,
} from "@/components/profile-edit/sections";

/**
 * Add or edit one of a company's tutors, with every field it can set.
 *
 * ONE component for both, seeded blank for an add and from the row for an edit,
 * exactly as app/author/[id] seeds a BLANK article so "new" and "existing" are
 * one code path rather than two field lists that drift.
 *
 * DIVISION OF LABOUR: this modal owns the DRAFT, the parent owns the NETWORK.
 * That is what lets add and edit share everything — CompanyTutorsEditor has a
 * single submit() whose only branch is whether the draft has an id yet.
 *
 * It is the shared Modal shell (a `sheet`: full screen below 640px), opened ON
 * TOP OF another modal (the "our tutors" EditRegion), which drives three
 * things that look like oversights and are not:
 *
 *   Scroll lock. Both this modal and the parent EditRegion are the shared
 *   Modal, whose lib/scrollLock.js lock is reference counted, so closing this
 *   one leaves the page behind the still-open parent frozen.
 *
 *   Escape is handled in the CAPTURE phase, with stopPropagation. The parent
 *   listens for Escape on `window` in the bubble phase and closes the whole
 *   section; window-capture runs first, so this closes only the top layer (and
 *   Modal's own Escape listener never sees it).
 *
 *   `dismissable={false}`: backdrop clicks do NOT close it, matching
 *   EditRegion rather than ReviewFormModal, because this holds a whole unsaved
 *   tutor. Cancel lives in the footer.
 *
 *   zIndex 95 sits above the parent Modal and below the toast's z-[100],
 *   which is how every error in this flow is reported.
 */

// Matches the COLUMN defaults, not the editor's: year_min/year_max default to
// 0 and 12 (0011/0019), while YearLevelsSection falls back to 7 and 12 when the
// field is missing. Seeding 7 here would write 7 on the first save and quietly
// drop the tutor out of every K to Year 6 browse filter.
const BLANK = {
  id: null,
  name: "",
  initial: null,
  avatarImg: null,
  avatarBg: null,
  bio: "",
  bioLong: "",
  credentials: [],
  subjects: [],
  yearMin: 0,
  yearMax: 12,
};

export function CompanyTutorModal({
  initial,
  ownerId,
  supabase,
  subjectCatalog,
  saving = false,
  onCancel,
  onSubmit,
}) {
  const creating = !initial?.id;
  // Subjects are read as objects and written as slugs, so normalise once here
  // rather than at every use.
  const [tutor, setTutor] = useState(() => ({
    ...BLANK,
    ...(initial ?? {}),
    subjects: (initial?.subjects ?? []).map((s) => s.slug ?? s),
  }));
  const set = (patch) => setTutor((t) => ({ ...t, ...patch }));

  useEffect(() => {
    // Capture phase + stopPropagation: see the note above the component.
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (!saving) onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [saving, onCancel]);

  const canSave = tutor.name.trim() !== "" && !saving;

  return (
    <Modal
      title={creating ? "Add a tutor" : tutor.name.trim() || "Edit tutor"}
      onClose={onCancel}
      dismissable={false}
      sheet
      width={680}
      zIndex={95}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSubmit(tutor)} disabled={!canSave}>
            {saving ? "Saving…" : creating ? "Add tutor" : "Save tutor"}
          </Button>
        </>
      }
    >
        <div className="space-y-4">
          <Field label="Name">
            <TextInput
              value={tutor.name}
              onChange={(v) => set({ name: v, initial: v.trim().charAt(0).toUpperCase() || null })}
              maxLength={80}
            />
          </Field>

          <ImageUploadControl
            label="Photo"
            value={tutor.avatarImg}
            kind="avatar"
            supabase={supabase}
            // The COMPANY OWNER's uid, not the tutor's. The profile-images
            // bucket policy (0006) is owner-by-uid-folder and checks auth.uid()
            // against the first path segment, so uploading under the tutor's id
            // would be rejected by Storage — silently, since the crop modal only
            // surfaces a generic failure. The bucket is public, so the file
            // being in the company's folder costs nothing on read.
            //
            // It is also what lets this popup exist: the upload does not need
            // the tutor row, so a photo can be chosen before the tutor is made.
            userId={ownerId}
            onChange={(url) => set({ avatarImg: url })}
            hint="Optional. A head-and-shoulders photo works best."
            aspect={1}
            cropShape="round"
            maxOutputPx={1024}
          />

          <Field label="Tagline" optional hint="One line, shown under their name.">
            <TextInput
              value={tutor.bio ?? ""}
              onChange={(v) => set({ bio: v })}
              placeholder="HSC Chemistry and Biology specialist."
              maxLength={140}
            />
          </Field>

          <Field label="About" optional>
            {/* RichTextField directly, not AboutSection: that one posts to
                /api/ai/generate-bio using the SIGNED-IN user's own profile as
                context, which is the company, not the tutor being written about. */}
            <RichTextField
              value={tutor.bioLong ?? ""}
              onChange={(v) => set({ bioLong: v })}
              placeholder="A few sentences about how they teach…"
              rows={5}
              maxLength={1200}
              lists
            />
          </Field>

          {/* The three shared sections, bare so they drop their Card wrapper.
              SubjectsSection rather than a raw SubjectPicker specifically for
              its height-reserve spacer, which is what stops the dropdown being
              clipped by this modal's scroll region. */}
          <SubjectsSection tutor={tutor} set={set} catalog={subjectCatalog} bare />
          <YearLevelsSection tutor={tutor} set={set} bare />
          <CredentialsSection tutor={tutor} set={set} bare />
        </div>
    </Modal>
  );
}
