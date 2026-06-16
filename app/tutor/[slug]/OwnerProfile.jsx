"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSubjects, getSchools, saveTutorProfile } from "@/lib/supabase/tutors";
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
  SaveBar,
  MobileSaveBar,
} from "@/components/profile-edit/sections";
import { ProfileHeaderText } from "./ProfileHeaderText";
import { AboutCard } from "./AboutCard";
import { RateCard } from "./RateCard";
import { CredentialsList } from "./CredentialsList";
import { ExperienceTimeline } from "./ExperienceTimeline";
import { EducationTimeline } from "./EducationTimeline";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { Section, SubjectsCard, ServiceAreaCard, formatDelivery, buildCredentialTiles } from "./ProfileCards";
import { OwnerToolbar } from "./OwnerToolbar";

const SAVEBAR_H = 68;

/**
 * Inline profile editor — the LinkedIn-style replacement for /settings. Renders
 * the tutor's own public profile from a live draft (editor shape → display
 * shape via editorToDisplay) so the page IS the preview. Each card carries a
 * pen that swaps its read-only view for the matching settings section form;
 * all edits share one draft and are committed together by the sticky SaveBar.
 */
export function OwnerProfile({ editorTutor, userId }) {
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
  const supabase = supabaseRef.current;

  const [tutor, setTutor] = useState(editorTutor);
  const [snapshot, setSnapshot] = useState(editorTutor);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { kind: 'ok' | 'warn' | 'error', text }
  const [subjectCatalog, setSubjectCatalog] = useState([]);
  const [schoolCatalog, setSchoolCatalog] = useState([]);
  const [openSections, setOpenSections] = useState(() => new Set());

  useEffect(() => {
    let active = true;
    getSubjects(supabase).then((rows) => { if (active) setSubjectCatalog(rows); });
    getSchools(supabase).then((rows) => { if (active) setSchoolCatalog(rows); });
    return () => { active = false; };
  }, [supabase]);

  const dirty = useMemo(
    () => JSON.stringify(tutor) !== JSON.stringify(snapshot),
    [tutor, snapshot]
  );

  const set = (patch) => setTutor((t) => ({ ...t, ...patch }));
  const nameValid = !!(tutor.name && tutor.name.trim());

  const toggle = (k) =>
    setOpenSections((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });

  const showToast = (kind, text, ms = 2400) => {
    setToast({ kind, text });
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), ms);
  };

  const onSave = async () => {
    if (!nameValid) {
      showToast("error", "Please enter your full name before saving.", 3500);
      return;
    }
    setSaving(true);
    // Last-chance geocode: if the user hit Save before the debounced editor
    // geocode fired, resolve coords now so the public profile has a map.
    let toSave = tutor;
    const sa = tutor.serviceArea;
    const suburb = (sa?.suburb || "").trim();
    const stale = suburb && (!Number.isFinite(sa?.lat) || !Number.isFinite(sa?.lng)
      || (sa?.geocodedSuburb || "").toLowerCase() !== suburb.toLowerCase());
    if (stale) {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(suburb)}`);
        if (res.ok) {
          const body = await res.json();
          if (Number.isFinite(body?.lat) && Number.isFinite(body?.lng)) {
            toSave = { ...tutor, serviceArea: { ...sa, lat: body.lat, lng: body.lng, geocodedSuburb: suburb } };
            setTutor(toSave);
          } else {
            toSave = { ...tutor, serviceArea: { ...sa, lat: null, lng: null, geocodedSuburb: null } };
            setTutor(toSave);
          }
        }
      } catch { /* save with whatever's there */ }
    }
    const result = await saveTutorProfile(supabase, userId, toSave);
    setSaving(false);
    if (!result.ok) {
      console.error("[profile] save failed:", result.error);
      showToast("error", result.error?.message || "Save failed — please try again.", 4000);
      return;
    }
    setSnapshot(toSave);
    if (result.droppedSubjects.length > 0) {
      const bySlug = new Map(subjectCatalog.map((s) => [s.slug, s]));
      const labels = result.droppedSubjects.map((slug) => subjectLabel(bySlug.get(slug) ?? { name: slug }));
      showToast("warn", `Saved. Skipped unrecognised subjects: ${labels.join(", ")}.`, 5000);
    } else {
      showToast("ok", "Profile saved", 1800);
    }
  };

  const onDiscard = () => setTutor(snapshot);

  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const display = useMemo(() => editorToDisplay(tutor, subjectCatalog), [tutor, subjectCatalog]);

  const publicHref = `matchtutor.com.au/tutor/${tutor.slug || userId}`;
  const publicUrl = `https://${publicHref}`;

  const credTiles = buildCredentialTiles(display.credentials);

  // Header view — banner + avatar + intro (plain div so toggling doesn't re-fire
  // the entrance animation on every edit).
  const headerView = (
    <div className="relative bg-[color:var(--paper-card)] overflow-hidden" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)" }}>
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
    </div>
  );

  return (
    <>
      <SaveBar tutor={tutor} dirty={dirty} saving={saving} onSave={onSave} onDiscard={onDiscard} profileHref={null} nameValid={nameValid} />
      <OwnerToolbar tutor={tutor} set={set} publicHref={publicHref} publicUrl={publicUrl} top={`calc(var(--nav-h) + ${SAVEBAR_H}px)`} />

      <div className="desk-surface relative overflow-hidden pb-32 md:pb-24">
        <DeskBackdrop />
        <div className="relative z-10 max-w-[1200px] mx-auto px-6 pt-6">
          {!nameValid && (
            <div className="mb-4 px-4 py-2.5 text-[13px] flex items-center gap-2" style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, color: "#92400E" }}>
              <Icon name="alert-triangle" size={15} strokeWidth={2} className="shrink-0" />
              Add your full name (edit the header) before you can save.
            </div>
          )}

          <EditRegion
            k="header"
            label="profile header"
            openSet={openSections}
            toggle={toggle}
            view={headerView}
            edit={
              <div className="space-y-5">
                <BannerAvatarSection tutor={tutor} set={set} supabase={supabase} />
                <IdentitySection tutor={tutor} set={set} />
                <YearLevelsSection tutor={tutor} set={set} />
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 mt-8 items-start">
            <div className="space-y-8 min-w-0">
              <EditRegion
                k="about" label="about" openSet={openSections} toggle={toggle}
                view={display.bioLong
                  ? <AboutCard text={display.bioLong} />
                  : <Section title="About"><EmptyHint>Tell students about your teaching approach.</EmptyHint></Section>}
                edit={<AboutSection tutor={tutor} set={set} />}
              />

              <EditRegion
                k="credentials" label="credentials" openSet={openSections} toggle={toggle}
                view={
                  <Section title="Credentials" subtitle="What sets you apart">
                    {credTiles.length > 0 ? <CredentialsList tiles={credTiles} /> : <EmptyHint>Add your ATAR, awards, degrees or state ranks.</EmptyHint>}
                  </Section>
                }
                edit={<CredentialsSection tutor={tutor} set={set} />}
              />

              <EditRegion
                k="experience" label="experience" openSet={openSections} toggle={toggle}
                view={
                  <Section title="Experience">
                    {display.experience.length > 0 ? <ExperienceTimeline experience={display.experience} /> : <EmptyHint>Add your tutoring or teaching roles.</EmptyHint>}
                  </Section>
                }
                edit={<ExperienceSection tutor={tutor} set={set} />}
              />

              <EditRegion
                k="education" label="education" openSet={openSections} toggle={toggle}
                view={
                  <Section title="Education">
                    {display.education.length > 0 ? <EducationTimeline education={display.education} /> : <EmptyHint>Add your high school and university.</EmptyHint>}
                  </Section>
                }
                edit={<EducationSection tutor={tutor} set={set} schoolCatalog={schoolCatalog} />}
              />

              <EditRegion
                k="availability" label="availability" openSet={openSections} toggle={toggle}
                view={
                  <Section title="Availability" subtitle="When students can book a session each week">
                    {display.availability ? <AvailabilityGrid availability={display.availability} /> : <EmptyHint>Set your weekly availability.</EmptyHint>}
                  </Section>
                }
                edit={<AvailabilitySection tutor={tutor} set={set} />}
              />
            </div>

            <aside className="space-y-5">
              <EditRegion
                k="rate" label="rate" openSet={openSections} toggle={toggle}
                view={<RateCard tutor={display} />}
                edit={<RateSection tutor={tutor} set={set} />}
              />

              <EditRegion
                k="subjects" label="subjects" openSet={openSections} toggle={toggle}
                view={display.subjects.length > 0
                  ? <SubjectsCard subjects={display.subjects} />
                  : <MiniCard title="Subjects"><EmptyHint>Add the subjects you tutor.</EmptyHint></MiniCard>}
                edit={<SubjectsSection tutor={tutor} set={set} catalog={subjectCatalog} />}
              />

              <EditRegion
                k="serviceArea" label="service area" openSet={openSections} toggle={toggle}
                view={(display.serviceArea?.suburb || display.suburb)
                  ? <ServiceAreaCard tutor={display} />
                  : <MiniCard title="Service area"><EmptyHint>Set the suburb you travel to for in-person lessons.</EmptyHint></MiniCard>}
                edit={<ServiceAreaSection tutor={tutor} set={set} />}
              />
            </aside>
          </div>
        </div>
      </div>

      <MobileSaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={onDiscard} profileHref={null} nameValid={nameValid} />

      {toast && (
        <div
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 text-[13.5px] inline-flex items-center gap-2"
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
    </>
  );
}

/**
 * Wraps a profile region with the inline-edit affordance: a pen at the card's
 * top-right in view mode; the section form plus a "Done" button (which only
 * collapses the form — saving is global via the SaveBar) in edit mode.
 */
function EditRegion({ k, label, openSet, toggle, view, edit }) {
  const open = openSet.has(k);
  if (open) {
    return (
      <div>
        {edit}
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={() => toggle(k)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] font-medium rounded-full transition-colors"
            style={{ background: "var(--ink)", color: "#fff" }}
          >
            <Icon name="check" size={13} strokeWidth={2.4} /> Done
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="relative">
      {view}
      <button
        type="button"
        onClick={() => toggle(k)}
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
        className="absolute top-3 right-3 z-10 inline-flex items-center justify-center transition-colors hover:bg-slate-100"
        style={{ width: 32, height: 32, borderRadius: 999, background: "var(--paper-card)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)", boxShadow: "0 1px 3px rgba(15,23,42,0.08)" }}
      >
        <Icon name="pencil" size={14} strokeWidth={2} />
      </button>
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
    <div className="bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 22 }}>
      <div className="text-[14px] font-semibold text-slate-900 mb-4">{title}</div>
      {children}
    </div>
  );
}
