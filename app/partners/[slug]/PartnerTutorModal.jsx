"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
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
 * Add or edit one of a centre's tutors, with every field it can set.
 *
 * ONE component for both, seeded blank for an add and from the row for an edit,
 * exactly as app/author/[id] seeds a BLANK article so "new" and "existing" are
 * one code path rather than two field lists that drift.
 *
 * DIVISION OF LABOUR: this modal owns the DRAFT, the parent owns the NETWORK.
 * That is what lets add and edit share everything — PartnerTutorsEditor has a
 * single submit() whose only branch is whether the draft has an id yet.
 *
 * It opens ON TOP OF another modal (the "our tutors" EditRegion), which drives
 * three things that look like oversights and are not:
 *
 *   It does NOT lock scroll. OwnerPartner already froze the body with a raw
 *   style.overflow save/restore that does not participate in lib/scrollLock.js's
 *   reference count. Calling lockScroll() here would take that count to 0 on
 *   close and hand scrolling back to the page behind a still-open parent.
 *
 *   Escape is handled in the CAPTURE phase, with stopPropagation. The parent
 *   listens for Escape on `window` in the bubble phase and closes the whole
 *   section; window-capture runs first, so this closes only the top layer.
 *   Nothing inside needs Escape (SubjectPicker closes on outside mousedown and
 *   ImageCropModal has no Escape handler), so swallowing it costs nothing.
 *
 *   z-[95] sits above the parent's z-[90] and below the toast's z-[100], which
 *   is how every error in this flow is reported.
 *
 * Backdrop clicks do NOT close it, matching EditRegion rather than
 * ReviewFormModal: this holds a whole unsaved tutor.
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

export function PartnerTutorModal({
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
      if (e.key !== "Escape" || saving) return;
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [saving, onCancel]);

  const canSave = tutor.name.trim() !== "" && !saving;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center px-4 py-6"
      style={{ background: "rgba(0,49,47,0.45)", backdropFilter: "blur(2px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={creating ? "Add a tutor" : `Edit ${initial?.name ?? "tutor"}`}
    >
      <div
        className="bg-[color:var(--paper-card)] w-full flex flex-col"
        style={{
          maxWidth: 680,
          maxHeight: "88vh",
          borderRadius: "var(--radius-card)",
          boxShadow: "0 24px 60px rgba(0,30,30,0.28)",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5 shrink-0"
          style={{ borderBottom: "1px solid var(--paper-line)" }}
        >
          <h2 className="text-[17px] font-light tracking-tight" style={{ color: "var(--ink-graphite)" }}>
            {creating ? "Add a tutor" : tutor.name.trim() || "Edit tutor"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-3.5 py-1.5 text-[12.5px] font-medium rounded-full disabled:opacity-60"
              style={{ border: "1px solid var(--paper-line)", color: "var(--ink-muted)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSubmit(tutor)}
              disabled={!canSave}
              className="px-3.5 py-1.5 text-[12.5px] font-medium rounded-full inline-flex items-center gap-1.5 disabled:opacity-60"
              style={{ background: "var(--ink)", color: "#fff" }}
            >
              {saving ? (
                "Saving…"
              ) : (
                <>
                  <Icon name="check" size={13} strokeWidth={2.4} />
                  {creating ? "Add tutor" : "Save tutor"}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          <Field label="Name">
            <TextInput
              value={tutor.name}
              onChange={(v) => set({ name: v, initial: v.trim().charAt(0).toUpperCase() || null })}
              placeholder="Jane Liu"
              maxLength={80}
            />
          </Field>

          <ImageUploadControl
            label="Photo"
            value={tutor.avatarImg}
            kind="avatar"
            supabase={supabase}
            // The PARTNER OWNER's uid, not the tutor's. The profile-images
            // bucket policy (0006) is owner-by-uid-folder and checks auth.uid()
            // against the first path segment, so uploading under the tutor's id
            // would be rejected by Storage — silently, since the crop modal only
            // surfaces a generic failure. The bucket is public, so the file
            // being in the centre's folder costs nothing on read.
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
                context, which is the centre, not the tutor being written about. */}
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
      </div>
    </div>,
    document.body
  );
}
