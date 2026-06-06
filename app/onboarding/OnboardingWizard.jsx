"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button, Chip } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSubjects, saveTutorProfile, markOnboarded } from "@/lib/supabase/tutors";
import { defaultTutor } from "../settings/SettingsEditor";
import {
  IdentitySection,
  SubjectsSection,
  YearLevelsSection,
  RateSection,
  AboutSection,
  ServiceAreaSection,
  CredentialsSection,
  ExperienceSection,
  EducationSection,
} from "../settings/sections";

// Delivery-mode question. The two toggles otherwise live inside
// BannerAvatarSection, which onboarding skips (it's mostly image uploads), so
// this small self-contained block surfaces just the in-person / online choice.
function DeliveryCard({ tutor, set }) {
  const inPerson = !!tutor.deliversInPerson;
  const online = !!tutor.deliversOnline;
  return (
    <div className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 14, padding: 24 }}>
      <h3 className="text-[16px] font-semibold text-slate-900">How do you teach?</h3>
      <p className="text-[13.5px] text-slate-500 mt-1 mb-4">Pick the lesson formats you offer — you can change these later.</p>
      <div className="flex flex-wrap gap-2.5">
        <Chip tone="grey" icon="map-pin" active={inPerson} onClick={() => set({ deliversInPerson: !inPerson })}>
          In person
        </Chip>
        <Chip tone="grey" icon="globe" active={online} onClick={() => set({ deliversOnline: !online })}>
          Online
        </Chip>
      </div>
    </div>
  );
}

// Each step renders one of the real settings sections, so the questionnaire
// stays in lockstep with the editor. `requireName` gates advancing on step 1
// (a display name is mandatory for saveTutorProfile and the public URL).
// `isAnswered` decides which advance button shows: Next once the step has
// content, Skip while it's still empty/default.
const hasText = (v) => !!(v && String(v).trim());

const STEPS = [
  {
    key: "identity",
    requireName: true,
    // Name is required to advance (see `requireName`), but it doesn't by itself
    // count as "answered": the button stays Skip until something *other* than the
    // name is filled in, then flips to Next.
    isAnswered: (t) =>
      (t.yearsTutoring ?? 0) > 0 ||
      (t.languages?.length ?? 0) > 0 ||
      (t.rate ?? 0) > 0 ||
      (t.packages?.length ?? 0) > 0,
    render: ({ tutor, set }) => (
      <div className="space-y-5">
        <IdentitySection tutor={tutor} set={set} />
        <RateSection tutor={tutor} set={set} />
      </div>
    ),
  },
  {
    key: "subjects",
    isAnswered: (t) => (t.subjects?.length ?? 0) > 0 || t.yearMin !== 7 || t.yearMax !== 12,
    render: ({ tutor, set, catalog }) => (
      <div className="space-y-5">
        <SubjectsSection tutor={tutor} set={set} catalog={catalog} />
        <YearLevelsSection tutor={tutor} set={set} />
      </div>
    ),
  },
  {
    key: "about",
    isAnswered: (t) => hasText(t.bio) || hasText(t.bioLong),
    render: ({ tutor, set }) => <AboutSection tutor={tutor} set={set} />,
  },
  {
    key: "location",
    isAnswered: (t) => hasText(t.serviceArea?.suburb) || !!t.deliversInPerson || !!t.deliversOnline,
    render: ({ tutor, set }) => (
      <div className="space-y-5">
        <ServiceAreaSection tutor={tutor} set={set} />
        <DeliveryCard tutor={tutor} set={set} />
      </div>
    ),
  },
  {
    key: "credentials",
    isAnswered: (t) =>
      (t.credentials ?? []).some((c) => hasText(c?.label)) ||
      (t.experience ?? []).some((e) => hasText(e?.role) || hasText(e?.org) || hasText(e?.note)),
    render: ({ tutor, set }) => (
      <div className="space-y-5">
        <CredentialsSection tutor={tutor} set={set} />
        <ExperienceSection tutor={tutor} set={set} />
      </div>
    ),
  },
  {
    key: "education",
    isAnswered: (t) => (t.education ?? []).some((e) => hasText(e?.school) || hasText(e?.detail)),
    render: ({ tutor, set }) => <EducationSection tutor={tutor} set={set} />,
  },
];

const stepVariants = {
  enter: (dir) => ({ x: dir > 0 ? 28 : -28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -28 : 28, opacity: 0 }),
};

export function OnboardingWizard({ initialTutor, userId, userEmail }) {
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
  const supabase = supabaseRef.current;
  const router = useRouter();

  // Start the delivery-format question with neither option pre-selected, so the
  // tutor actively picks (the DB columns default to true, and defaultTutor
  // mirrors that — we override just for the onboarding question).
  const seed = useMemo(
    () => ({
      ...(initialTutor ?? defaultTutor(userId, userEmail)),
      deliversInPerson: false,
      deliversOnline: false,
    }),
    [initialTutor, userId, userEmail]
  );

  const [tutor, setTutor] = useState(seed);
  const [catalog, setCatalog] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { kind, text }

  const set = (patch) => setTutor((t) => ({ ...t, ...patch }));

  useEffect(() => {
    let active = true;
    getSubjects(supabase).then((rows) => { if (active) setCatalog(rows); });
    return () => { active = false; };
  }, [supabase]);

  const showToast = (kind, text, ms = 3500) => {
    setToast({ kind, text });
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), ms);
  };

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const nameValid = !!(tutor.name && tutor.name.trim());
  // Step 1 can't be advanced (Skip or Next) until a name is entered.
  const advanceDisabled = !!step.requireName && !nameValid;
  // Show Next once the step has content other than the name; Skip while it's
  // still empty/default (the name alone doesn't flip Skip → Next).
  const answered = step.isAnswered ? step.isAnswered(tutor) : false;
  const showNext = answered;

  const goBack = () => {
    if (isFirst) return;
    setDir(-1);
    setStepIndex((i) => i - 1);
  };

  const goNext = () => {
    if (advanceDisabled) return;
    if (isLast) { complete(); return; }
    setDir(1);
    setStepIndex((i) => i + 1);
  };

  // Finish or "Skip everything": persist whatever's been entered (when a name
  // exists — saveTutorProfile rejects a blank name), flip the onboarded flag so
  // the wizard never reappears, then land the tutor in their settings editor.
  const complete = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (nameValid) {
        // Last-chance geocode, mirroring SettingsEditor.onSave: if the picked
        // suburb never resolved to coords, fetch them now so the map renders.
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
              } else {
                toSave = { ...tutor, serviceArea: { ...sa, lat: null, lng: null, geocodedSuburb: null } };
              }
            }
          } catch { /* save with whatever's there */ }
        }
        const result = await saveTutorProfile(supabase, userId, toSave);
        if (!result.ok) {
          setSubmitting(false);
          showToast("error", result.error?.message || "Couldn't save — please try again.");
          return;
        }
      }
      await markOnboarded(supabase, userId);
      // Always land on /settings: a brand-new (unconfirmed) tutor's public page
      // 404s until email confirmation, and the slug may have been regenerated
      // server-side if the name changed.
      router.replace("/settings");
    } catch (e) {
      setSubmitting(false);
      showToast("error", "Something went wrong — please try again.");
    }
  };

  return (
    <div className="bg-white min-h-[calc(100vh-60px)]">
      <div className="max-w-[760px] mx-auto px-6 pt-10 pb-32">
        {/* Intro */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 text-[12.5px] font-medium px-2.5 py-1 mb-3"
            style={{ background: "var(--accent-softer)", color: "var(--accent)", border: "1px solid var(--accent-line)", borderRadius: 999 }}>
            <Icon name="sparkle" size={13} /> Welcome to matchtutor
          </div>
          <h1 className="text-[26px] font-semibold text-slate-900 tracking-tight">Let’s set up your profile</h1>
          <p className="text-[14.5px] text-slate-500 mt-1.5">
            A few quick questions to get you listed. Skip anything you’re not ready for — you can edit it all later in Settings.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-1.5 flex-1">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: i <= stepIndex ? "var(--accent)" : "#E5E7EB" }}
              />
            ))}
          </div>
          <span className="text-[12.5px] text-slate-400 tabular-nums shrink-0">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
        </div>

        {/* Step content */}
        <div className="min-h-[280px]">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step.key}
              custom={dir}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {step.render({ tutor, set, catalog })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between gap-3 mt-8">
          <button
            type="button"
            onClick={complete}
            disabled={submitting}
            className="text-[13px] text-slate-400 hover:text-slate-600 underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip everything
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="ghost" size="md" icon="chevron-left" onClick={goBack} disabled={submitting}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button variant="primary" size="md" icon="check" onClick={goNext} disabled={advanceDisabled || submitting}>
                {submitting ? "Finishing…" : "Finish"}
              </Button>
            ) : showNext ? (
              <Button variant="primary" size="md" iconRight="arrow-right" onClick={goNext} disabled={advanceDisabled || submitting}>
                Next
              </Button>
            ) : (
              <Button variant="outline" size="md" onClick={goNext} disabled={advanceDisabled || submitting}>
                Skip
              </Button>
            )}
          </div>
        </div>

        {step.requireName && !nameValid && (
          <p className="text-[12.5px] mt-3 text-right" style={{ color: "#B45309" }}>
            Enter your full name to continue.
          </p>
        )}
      </div>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 text-[13.5px] inline-flex items-center gap-2"
          style={{
            background: toast.kind === "error" ? "#B91C1C" : "#0F172A",
            color: "#fff",
            borderRadius: 999,
            boxShadow: "0 10px 30px rgba(15,23,42,0.2)",
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          <Icon name={toast.kind === "error" ? "x" : "check"} size={14} strokeWidth={3} />
          <span className="truncate">{toast.text}</span>
        </div>
      )}
    </div>
  );
}
