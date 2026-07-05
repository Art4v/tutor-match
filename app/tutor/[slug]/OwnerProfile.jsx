"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { EASE_OUT, DURATION_MED } from "@/lib/motion";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSubjects, getSchools, saveTutorProfile } from "@/lib/supabase/tutors";
import { listTutorDocs } from "@/lib/supabase/storage";
import { DocumentationUploader } from "@/components/DocumentationUploader";
import { subjectLabel } from "@/lib/subjects";
import { editorToDisplay } from "@/lib/tutorShape";
import {
  BannerAvatarSection,
  IdentitySection,
  YearLevelsSection,
  CredentialsSection,
  AboutSection,
  RateSection,
  ExperienceSection,
  EducationSection,
  SubjectsSection,
  ServiceAreaSection,
  AvailabilitySection,
} from "@/components/profile-edit/sections";
import { ProfileHeaderText } from "./ProfileHeaderText";
import { AboutCard } from "./AboutCard";
import { RateCard } from "./RateCard";
import { CredentialsList } from "./CredentialsList";
import { ExperienceTimeline } from "./ExperienceTimeline";
import { EducationTimeline } from "./EducationTimeline";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { Section, SubjectsCard, DocumentationCard, ServiceAreaCard, formatDelivery, buildCredentialTiles } from "./ProfileCards";
import { SectionReveal } from "@/components/anim/SectionReveal";
import { OwnerCard } from "./OwnerCard";

/**
 * Inline profile editor — the LinkedIn-style replacement for /settings. Renders
 * the tutor's own public profile from the committed `profile` (editor shape →
 * display shape via editorToDisplay). Each card carries a pen that opens its
 * matching settings section form; **each section saves independently** (Save /
 * Cancel live inside the card) — there is no global save bar and no top banner.
 * Only one section is open at a time, so a save never clobbers another section.
 */
export function OwnerProfile({ editorTutor, userId }) {
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
  const supabase = supabaseRef.current;

  const [profile, setProfile] = useState(editorTutor); // committed/saved truth
  const [editingKey, setEditingKey] = useState(null);  // open section, or null
  const [draft, setDraft] = useState(editorTutor);      // working copy of open section
  const [savingKey, setSavingKey] = useState(null);
  const [toast, setToast] = useState(null);             // { kind, text }
  const [subjectCatalog, setSubjectCatalog] = useState([]);
  const [schoolCatalog, setSchoolCatalog] = useState([]);
  // Documents live in Storage + tutor_documents (not the profile row), so
  // they're state of their own: the editor drafts changes internally and
  // applies them via its commit() ref when this section's Save runs.
  const [docs, setDocs] = useState([]);
  const [docsDirty, setDocsDirty] = useState(false);
  const docsEditorRef = useRef(null);

  useEffect(() => {
    let active = true;
    getSubjects(supabase).then((rows) => { if (active) setSubjectCatalog(rows); });
    getSchools(supabase).then((rows) => { if (active) setSchoolCatalog(rows); });
    listTutorDocs(supabase, userId).then((rows) => { if (active) setDocs(rows); });
    return () => { active = false; };
  }, [supabase, userId]);

  const showToast = (kind, text, ms = 2200) => {
    setToast({ kind, text });
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), ms);
  };

  // Opening a section reseeds the working draft from committed truth, so an
  // abandoned edit elsewhere can never leak into this one.
  const openSection = (k) => {
    setDraft({ ...profile });
    setEditingKey(k);
  };
  const cancel = () => {
    setEditingKey(null);
    setDocsDirty(false); // the documentation draft unmounts with its modal
  };
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const dirty = useMemo(
    () => editingKey != null && JSON.stringify(draft) !== JSON.stringify(profile),
    [editingKey, draft, profile]
  );

  const saveSection = async (k) => {
    if (savingKey) return;
    let toSave = draft;
    // Service area: resolve coords now if the debounced editor geocode hasn't.
    if (k === "serviceArea") {
      const sa = draft.serviceArea;
      const suburb = (sa?.suburb || "").trim();
      const stale = suburb && (!Number.isFinite(sa?.lat) || !Number.isFinite(sa?.lng)
        || (sa?.geocodedSuburb || "").toLowerCase() !== suburb.toLowerCase());
      if (stale) {
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(suburb)}`);
          if (res.ok) {
            const body = await res.json();
            if (Number.isFinite(body?.lat) && Number.isFinite(body?.lng)) {
              toSave = { ...draft, serviceArea: { ...sa, lat: body.lat, lng: body.lng, geocodedSuburb: suburb } };
            } else {
              toSave = { ...draft, serviceArea: { ...sa, lat: null, lng: null, geocodedSuburb: null } };
            }
            setDraft(toSave);
          }
        } catch { /* save with whatever's there */ }
      }
    }
    setSavingKey(k);
    const result = await saveTutorProfile(supabase, userId, toSave);
    setSavingKey(null);
    if (!result.ok) {
      console.error("[profile] save failed:", result.error);
      showToast("error", result.error?.message || "Save failed — please try again.", 4000);
      return;
    }
    setProfile(toSave);
    setEditingKey(null);
    if (result.droppedSubjects.length > 0) {
      const bySlug = new Map(subjectCatalog.map((s) => [s.slug, s]));
      const labels = result.droppedSubjects.map((slug) => subjectLabel(bySlug.get(slug) ?? { name: slug }));
      showToast("warn", `Saved. Skipped unrecognised subjects: ${labels.join(", ")}.`, 5000);
    } else {
      showToast("ok", "Section saved", 1600);
    }
  };

  // Documentation saves outside saveTutorProfile: the editor's commit() applies
  // its draft (uploads / removals / renames) against Storage + tutor_documents
  // and returns the persisted list plus any per-file failures.
  const saveDocumentation = async () => {
    if (savingKey) return;
    setSavingKey("documentation");
    const result = await docsEditorRef.current?.commit();
    setSavingKey(null);
    if (!result) {
      showToast("error", "Save failed — please try again.", 4000);
      return;
    }
    setDocs(result.docs);
    setDocsDirty(false);
    setEditingKey(null);
    if (result.errors.length > 0) {
      showToast("warn", `Saved, with issues: ${result.errors.map((e) => `${e.name} (${e.message})`).join("; ")}`, 6000);
    } else {
      showToast("ok", "Section saved", 1600);
    }
  };

  // Visibility lives in the owner card and has no section editor, so it persists
  // immediately. Keep any open draft in sync so a later section save doesn't
  // revert the visibility change.
  const onVisibilityChange = async (value) => {
    const next = { ...profile, visibility: value };
    const result = await saveTutorProfile(supabase, userId, next);
    if (!result.ok) {
      showToast("error", result.error?.message || "Couldn't update visibility.", 3500);
      return false;
    }
    setProfile(next);
    setDraft((d) => ({ ...d, visibility: value }));
    return true;
  };

  useEffect(() => {
    const h = (e) => { if (dirty || docsDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, docsDirty]);

  // While a section editor is open it renders as a modal: lock the background
  // scroll (same approach as the image lightbox in HomeHowItWorks) and let
  // Escape close it. Restored when the editor closes.
  useEffect(() => {
    if (!editingKey) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") { setEditingKey(null); setDocsDirty(false); } };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [editingKey]);

  const display = useMemo(() => editorToDisplay(profile, subjectCatalog), [profile, subjectCatalog]);
  const credTiles = buildCredentialTiles(display.credentials);

  const publicHref = `matchtutor.com.au/tutor/${profile.slug || userId}`;
  const publicUrl = `https://${publicHref}`;

  // Rendered twice (mobile under the header, desktop at the top of the sidebar)
  // so the completion/verification nudge leads on phones instead of sitting
  // below all the profile content when the grid collapses to one column.
  const ownerCard = (
    <OwnerCard profile={profile} onVisibilityChange={onVisibilityChange} publicHref={publicHref} publicUrl={publicUrl} />
  );

  const regionProps = (k, label, maxW = 760) => ({
    label,
    maxW,
    editing: editingKey === k,
    saving: savingKey === k,
    // Only the open section renders its modal, so the shared `dirty` (draft vs
    // committed profile) is exactly this section's unsaved state.
    dirty,
    onEdit: () => openSection(k),
    onCancel: cancel,
    onSave: () => saveSection(k),
  });

  // Header view — motion.div (not SectionReveal) so opening/closing an edit
  // doesn't re-fire the entrance reveal, but it still gets the same quiet hover
  // lift as the other cards (whileHover only; no whileInView entrance).
  const headerView = (
    <motion.div
      className="paper-page relative bg-[color:var(--paper-card)] overflow-hidden"
      style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)" }}
      whileHover={{ y: -2, boxShadow: "0 16px 32px -22px rgba(15,23,42,0.22)", borderColor: "var(--line-strong)" }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
    >
      <div
        style={{
          height: 140,
          background: display.bannerImg
            ? `url(${display.bannerImg}) center / cover no-repeat`
            : `linear-gradient(135deg, ${display.bannerBg ?? display.avatarBg}, oklch(0.96 0.01 250))`,
        }}
      />
      <div className="px-7 pb-7" style={{ marginTop: -54 }}>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <Avatar tutor={display} size={108} ring />
        </div>
        <ProfileHeaderText tutor={display} deliveryLabel={formatDelivery(display)} />
      </div>
    </motion.div>
  );

  return (
    <div className="bg-[color:var(--paper-card)] bleed-under-nav relative overflow-hidden pb-24">
      <DeskBackdrop />
      <div className="relative z-10 max-w-[1200px] mx-auto px-6 pt-6">
        <EditRegion
          {...regionProps("header", "profile header", 1100)}
          view={headerView}
          edit={
            <div>
              <h2 className="text-[18px] font-semibold text-slate-900 tracking-tight">Profile header</h2>
              <p className="text-[13px] text-slate-500 mt-1 mb-5">The banner, photo and intro at the top of your profile.</p>
              <BannerAvatarSection tutor={draft} set={set} supabase={supabase} bare />
              <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--desk)" }}>
                <IdentitySection tutor={draft} set={set} bare />
              </div>
              <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--desk)" }}>
                <YearLevelsSection tutor={draft} set={set} bare />
              </div>
            </div>
          }
        />

        {/* Mobile only: "Your profile" card sits directly under the header,
            above the profile content. On desktop it lives at the top of the
            right sidebar (below), so it's hidden here. */}
        <div className="lg:hidden mt-8">{ownerCard}</div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 mt-8 items-start">
          <div className="space-y-8 min-w-0">
            <EditRegion
              {...regionProps("about", "about")}
              view={display.bioLong
                ? <AboutCard text={display.bioLong} />
                : <Section title="About"><EmptyHint>Tell students about your teaching approach.</EmptyHint></Section>}
              edit={<AboutSection tutor={draft} set={set} bare />}
            />

            <EditRegion
              {...regionProps("credentials", "credentials")}
              view={
                <Section title="Credentials" subtitle="What sets you apart">
                  {credTiles.length > 0 ? <CredentialsList tiles={credTiles} /> : <EmptyHint>Add your ATAR, awards, degrees or state ranks.</EmptyHint>}
                </Section>
              }
              edit={<CredentialsSection tutor={draft} set={set} bare />}
            />

            <EditRegion
              {...regionProps("experience", "experience")}
              view={
                <Section title="Experience">
                  {display.experience.length > 0 ? <ExperienceTimeline experience={display.experience} /> : <EmptyHint>Add your tutoring or teaching roles.</EmptyHint>}
                </Section>
              }
              edit={<ExperienceSection tutor={draft} set={set} bare />}
            />

            <EditRegion
              {...regionProps("education", "education")}
              view={
                <Section title="Education">
                  {display.education.length > 0 ? <EducationTimeline education={display.education} /> : <EmptyHint>Add your high school and university.</EmptyHint>}
                </Section>
              }
              edit={<EducationSection tutor={draft} set={set} schoolCatalog={schoolCatalog} bare />}
            />

            <EditRegion
              {...regionProps("availability", "availability")}
              view={
                <Section title="Availability" subtitle="When students can book a session each week">
                  {display.availability ? <AvailabilityGrid availability={display.availability} /> : <EmptyHint>Set your weekly availability.</EmptyHint>}
                </Section>
              }
              edit={<AvailabilitySection tutor={draft} set={set} bare />}
            />
          </div>

          <aside className="space-y-5">
            <div className="hidden lg:block">{ownerCard}</div>

            <EditRegion
              {...regionProps("rate", "rate", 480)}
              view={<RateCard tutor={display} />}
              edit={<RateSection tutor={draft} set={set} bare />}
            />

            <EditRegion
              {...regionProps("subjects", "subjects", 560)}
              view={display.subjects.length > 0
                ? <SubjectsCard subjects={display.subjects} />
                : <MiniCard title="Subjects"><EmptyHint>Add the subjects you tutor.</EmptyHint></MiniCard>}
              edit={<SubjectsSection tutor={draft} set={set} catalog={subjectCatalog} bare />}
            />

            {/* Documentation saves to Storage + tutor_documents (not the
                profile row), so this region overrides dirty/onSave with the
                doc editor's own draft state and commit(). */}
            <EditRegion
              {...regionProps("documentation", "documentation", 520)}
              dirty={docsDirty}
              onSave={saveDocumentation}
              view={docs.length > 0
                ? <DocumentationCard docs={docs} />
                : <MiniCard title="Documentation"><EmptyHint>Share documents that back up your credentials, like your WWCC, transcripts and certificates.</EmptyHint></MiniCard>}
              edit={<DocumentationUploader ref={docsEditorRef} userId={userId} docs={docs} onDirtyChange={setDocsDirty} />}
            />

            <EditRegion
              {...regionProps("serviceArea", "service area", 520)}
              view={(display.serviceArea?.suburb || display.suburb)
                ? <ServiceAreaCard tutor={display} />
                : <MiniCard title="Service area"><EmptyHint>Set the suburb you travel to for in-person lessons.</EmptyHint></MiniCard>}
              edit={<ServiceAreaSection tutor={draft} set={set} bare />}
            />
          </aside>
        </div>
      </div>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 text-[13.5px] inline-flex items-center gap-2"
          style={{
            background: toast.kind === "error" ? "#B91C1C" : toast.kind === "warn" ? "#92400E" : "var(--ink)",
            color: "#fff",
            borderRadius: 999,
            boxShadow: "0 10px 30px rgba(15,23,42,0.2)",
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          <Icon name={toast.kind === "ok" ? "check" : toast.kind === "warn" ? "shield" : "x"} size={14} strokeWidth={3} />
          <span className="truncate">{toast.text}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Wraps a profile region with inline editing: a pen at the card's top-right in
 * view mode; the section form plus a Cancel / Save footer in edit mode. Save
 * persists only this section (handled by the parent's saveSection).
 */
function EditRegion({ editing, saving, dirty, onEdit, onCancel, onSave, label, view, edit, maxW = 640 }) {
  // Always render the read-only view; in edit mode it sits (blurred) behind a
  // modal overlay so the page itself stays the preview. The overlay is
  // portaled to <body> so ancestor overflow/transforms can't clip it. The
  // editor is one card with a sticky Save/Cancel action bar at the top-right.
  return (
    <div className="relative">
      {view}
      {!editing && (
        <motion.button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          title={`Edit ${label}`}
          className="absolute top-3 right-3 z-10 inline-flex items-center justify-center transition-colors hover:bg-slate-100"
          style={{ width: 32, height: 32, borderRadius: 999, background: "var(--paper-card)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)", boxShadow: "0 1px 3px rgba(15,23,42,0.08)" }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
          transition={{ duration: DURATION_MED, ease: EASE_OUT, delay: 0.15 }}
        >
          <Icon name="pencil" size={14} strokeWidth={2} />
        </motion.button>
      )}
      {editing && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6"
          style={{ background: "rgba(42,58,46,0.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${label}`}
        >
          <div
            className="w-full flex flex-col bg-[color:var(--paper-card)]"
            style={{ maxWidth: maxW, maxHeight: "88vh", border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", boxShadow: "0 30px 80px -40px rgba(15,23,42,0.35)" }}
          >
            <div className="shrink-0 flex items-center justify-end gap-2 px-5 sm:px-6 py-3" style={{ borderBottom: "1px solid var(--desk)" }}>
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="px-3.5 py-1.5 text-[12.5px] font-medium rounded-full transition-colors hover:bg-slate-100 disabled:opacity-60"
                style={{ background: "var(--paper-card)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving || !dirty}
                className="px-3.5 py-1.5 text-[12.5px] font-medium rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                style={{ background: "var(--ink)", color: "#fff" }}
              >
                {saving ? "Saving…" : (<><Icon name="check" size={13} strokeWidth={2.4} /> Save</>)}
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5" data-lenis-prevent>
              {edit}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function EmptyHint({ children }) {
  return (
    <div className="text-[13.5px] text-slate-500 py-4 px-4 text-center" style={{ background: "var(--bg-soft)", borderRadius: 10 }}>
      {children}
    </div>
  );
}

function MiniCard({ title, children }) {
  return (
    <SectionReveal hover className="paper-page bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 22 }}>
      <div className="text-[14px] font-semibold text-slate-900 mb-4">{title}</div>
      {children}
    </SectionReveal>
  );
}
