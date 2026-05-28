"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSubjects, saveTutorProfile } from "@/lib/supabase/tutors";
import { subjectLabel } from "@/lib/subjects";
import {
  BannerAvatarSection,
  IdentitySection,
  CredentialsSection,
  AboutSection,
  RateSection,
  ExperienceSection,
  EducationSection,
  SubjectsSection,
  YearLevelsSection,
  ServiceAreaSection,
  AvailabilitySection,
  VerificationsSection,
  Sidebar,
  SaveBar,
  MobileSaveBar,
  buildInitialAvailability,
} from "./sections";

/**
 * Defaults used when the DB hasn't been populated yet (a brand-new tutor
 * signup). The handle_new_user() trigger creates an empty tutor_profiles
 * row, so these mostly cover null columns.
 */
function defaultTutor(userId, userEmail, fullName) {
  return {
    id: userId,
    name: fullName || "",
    suburb: "",
    city: "",
    initial: (fullName || userEmail || "?").charAt(0).toUpperCase(),
    avatarBg: "oklch(0.92 0.04 80)",
    avatarImg: null,
    bannerImg: null,
    verified: false,
    deliversInPerson: true,
    deliversOnline: true,
    responsiveText: "Usually responds in <1 hr",
    languages: [],
    yearsTutoring: 0,
    credentials: [],
    bio: "",
    bioLong: "",
    atar: 0,
    rank: "",
    rankSubject: "",
    rating: null,
    reviews: 0,
    rate: 0,
    packages: [],
    experience: [],
    education: [],
    subjects: [],
    yearMin: 7,
    yearMax: 12,
    serviceArea: { suburb: "", radiusKm: 5 },
    availability: buildInitialAvailability(),
    verifications: [
      { label: "Email verified", done: false },
      { label: "Phone verified", done: false },
      { label: "Government ID", done: false },
      { label: "ATAR transcript", done: false },
      { label: "University enrolment", done: false },
    ],
    visibility: "public",
  };
}

export function SettingsEditor({ initialTutor, userId, userEmail }) {
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
  const supabase = supabaseRef.current;

  const seed = useMemo(
    () => initialTutor ?? defaultTutor(userId, userEmail),
    [initialTutor, userId, userEmail]
  );

  const [tutor, setTutor] = useState(seed);
  const [snapshot, setSnapshot] = useState(seed);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { kind: 'ok' | 'warn' | 'error', text }
  const [subjectCatalog, setSubjectCatalog] = useState([]);

  useEffect(() => {
    let active = true;
    getSubjects(supabase).then((rows) => {
      if (active) setSubjectCatalog(rows);
    });
    return () => { active = false; };
  }, [supabase]);

  const dirty = useMemo(
    () => JSON.stringify(tutor) !== JSON.stringify(snapshot),
    [tutor, snapshot]
  );

  const set = (patch) => setTutor((t) => ({ ...t, ...patch }));

  const showToast = (kind, text, ms = 2400) => {
    setToast({ kind, text });
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), ms);
  };

  const onSave = async () => {
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
      console.error("[settings] save failed:", result.error);
      showToast("error", result.error?.message || "Save failed — please try again.", 4000);
      return;
    }
    setSnapshot(tutor);
    if (result.droppedSubjects.length > 0) {
      const bySlug = new Map(subjectCatalog.map((s) => [s.slug, s]));
      const labels = result.droppedSubjects.map((slug) => subjectLabel(bySlug.get(slug) ?? { name: slug }));
      showToast(
        "warn",
        `Saved. Skipped unrecognised subjects: ${labels.join(", ")}.`,
        5000
      );
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

  const profileSlug = tutor.slug || userId;
  const publicHref = `matchtutor.com.au/tutor/${profileSlug}`;
  const publicUrl = `https://${publicHref}`;

  return (
    <div className="bg-white min-h-screen pb-32 md:pb-12">
      <SaveBar tutor={tutor} dirty={dirty} saving={saving} onSave={onSave} onDiscard={onDiscard} />

      <div className="max-w-[1200px] mx-auto px-6 pt-6">
        <div className="flex items-end justify-between gap-4 mb-7">
          <div>
            <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight">Edit your profile</h1>
            <p className="text-[14px] text-slate-500 mt-1">Changes appear immediately on your public profile once saved.</p>
          </div>
          <div className="hidden lg:block text-[12.5px] text-slate-400 tabular-nums">
            {dirty ? "Unsaved edits" : "All changes saved"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div className="space-y-5 min-w-0">
            <BannerAvatarSection tutor={tutor} set={set} supabase={supabase} />
            <IdentitySection tutor={tutor} set={set} />
            <CredentialsSection tutor={tutor} set={set} />
            <AboutSection tutor={tutor} set={set} />
            <RateSection tutor={tutor} set={set} />
            <ExperienceSection tutor={tutor} set={set} />
            <EducationSection tutor={tutor} set={set} />
            <SubjectsSection tutor={tutor} set={set} catalog={subjectCatalog} />
            <YearLevelsSection tutor={tutor} set={set} />
            <ServiceAreaSection tutor={tutor} set={set} />
            <AvailabilitySection tutor={tutor} set={set} />
          </div>

          <div className="space-y-5 lg:sticky lg:top-[88px]">
            <Sidebar tutor={tutor} set={set} publicHref={publicHref} publicUrl={publicUrl} catalog={subjectCatalog} />
            <VerificationsSection />
          </div>
        </div>
      </div>

      <MobileSaveBar dirty={dirty} saving={saving} onSave={onSave} onDiscard={onDiscard} />

      {toast && (
        <div
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 text-[13.5px] inline-flex items-center gap-2"
          style={{
            background: toast.kind === "error" ? "#B91C1C" : toast.kind === "warn" ? "#92400E" : "#0F172A",
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
