"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Toast, useToast } from "@/components/Toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSubjects, getSchools, saveTutorProfile, markOnboarded } from "@/lib/supabase/tutors";
import { defaultTutor } from "@/components/profile-edit/defaults";
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
  ProfileImagesSection,
  Toggle,
  calcCompletion,
} from "@/components/profile-edit/sections";
import { RequestVerification } from "@/components/RequestVerification";

// Delivery-mode question. The two toggles otherwise live inside
// BannerAvatarSection, which onboarding skips (it's mostly image uploads), so
// this small self-contained block surfaces just the in-person / online choice.
function DeliveryCard({ tutor, set }) {
  const inPerson = !!tutor.deliversInPerson;
  const online = !!tutor.deliversOnline;
  // A flat section with two checkbox rows (no chips: DESIGN.md keeps chips for
  // removable filter values).
  return (
    <section className="py-6">
      <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">How do you teach?</h2>
      <p className="mt-1 mb-2 text-[14px] leading-5 text-[color:var(--text-2)]">Pick the lesson formats you offer. You can change these later.</p>
      <Toggle value={inPerson} onChange={(v) => set({ deliversInPerson: v })} label="In person" />
      <Toggle value={online} onChange={(v) => set({ deliversOnline: v })} label="Online" />
    </section>
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
      !!t.avatarImg ||
      !!t.bannerImg ||
      (t.yearsTutoring ?? 0) > 0 ||
      (t.languages?.length ?? 0) > 0 ||
      (t.rate ?? 0) > 0 ||
      (t.packages?.length ?? 0) > 0,
    render: ({ tutor, set, supabase }) => (
      <div>
        <ProfileImagesSection tutor={tutor} set={set} supabase={supabase} />
        <IdentitySection tutor={tutor} set={set} />
        <RateSection tutor={tutor} set={set} />
      </div>
    ),
  },
  {
    key: "subjects",
    isAnswered: (t) => (t.subjects?.length ?? 0) > 0 || t.yearMin !== 7 || t.yearMax !== 12,
    render: ({ tutor, set, catalog }) => (
      <div>
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
      <div>
        <ServiceAreaSection tutor={tutor} set={set} />
        <DeliveryCard tutor={tutor} set={set} />
      </div>
    ),
  },
  {
    key: "credentials",
    isAnswered: (t) =>
      (t.credentials ?? []).some((c) => hasText(c?.label)) ||
      (t.experience ?? []).some((e) => hasText(e?.role) || hasText(e?.org) || hasText(e?.note)) ||
      (t.education ?? []).some((e) => hasText(e?.school) || hasText(e?.detail)),
    render: ({ tutor, set, schoolCatalog }) => (
      <div>
        <CredentialsSection tutor={tutor} set={set} />
        <ExperienceSection tutor={tutor} set={set} />
        <EducationSection tutor={tutor} set={set} schoolCatalog={schoolCatalog} />
      </div>
    ),
  },
  {
    // Final step: a soft, optional prompt to request verification. Never gates
    // Finish — mirrors the /settings sidebar behaviour. `render` receives extra
    // wizard props (persistProfile, showToast) so the request can save first.
    key: "verify",
    isAnswered: () => true,
    render: ({ tutor, set, persistProfile, showToast }) => (
      <div>
        <div className="mb-6">
          <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">
            All done?
          </h2>
          <p className="mt-1 text-[14px] leading-5 text-[color:var(--text-2)]">
            Get verified now to strengthen your profile. You can also request it any time from your profile.
          </p>
        </div>
        <RequestVerification
          status={tutor.verificationStatus}
          completionPct={calcCompletion(tutor).pct}
          beforeRequest={async () => {
            const r = await persistProfile();
            if (!r.ok) {
              showToast("error", r.error || "Couldn't save. Please try again.");
              return false;
            }
            return true;
          }}
          onRequested={(s) => set({ verificationStatus: s })}
        />
      </div>
    ),
  },
];

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
  const [schoolCatalog, setSchoolCatalog] = useState([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, pushToast] = useToast();

  const set = (patch) => setTutor((t) => ({ ...t, ...patch }));

  useEffect(() => {
    let active = true;
    getSubjects(supabase).then((rows) => { if (active) setCatalog(rows); });
    getSchools(supabase).then((rows) => { if (active) setSchoolCatalog(rows); });
    return () => { active = false; };
  }, [supabase]);

  // The shared Toast (same signature); its warning kind is "warning".
  const showToast = (kind, text, ms = 3500) => pushToast(kind === "warn" ? "warning" : kind, text, ms);

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
    setStepIndex((i) => i - 1);
  };

  const goNext = () => {
    if (advanceDisabled) return;
    if (isLast) { complete(); return; }
    setStepIndex((i) => i + 1);
  };

  // Save whatever's been entered so far. Shared by `complete()` (Finish /
  // Skip everything) and the verification step's `beforeRequest` — the
  // verification API reads the tutor row from the DB, so the profile must be
  // persisted before requesting. Returns { ok, error }.
  const persistProfile = async () => {
    if (!nameValid) return { ok: false, error: "Enter your full name first." };
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
    if (!result.ok) return { ok: false, error: result.error?.message || "Couldn't save. Please try again." };
    // Keep what was saved (including any geocode just resolved) so the next
    // save sends the same thing. The wizard saves twice when the tutor requests
    // verification (before the request, then on Finish), and the second save
    // must be a no-op or it would withdraw the request it just made (0072).
    setTutor((t) => ({
      ...toSave,
      verificationStatus: result.verificationWithdrawn ? "none" : t.verificationStatus,
    }));
    if (result.verificationWithdrawn) {
      showToast("warn", "Your verification request was withdrawn because your profile changed. You can request it again any time.");
    }
    return { ok: true };
  };

  // Finish or "Skip everything": persist whatever's been entered (when a name
  // exists — saveTutorProfile rejects a blank name), flip the onboarded flag so
  // the wizard never reappears, then land the tutor in their settings editor.
  const complete = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (nameValid) {
        const result = await persistProfile();
        if (!result.ok) {
          setSubmitting(false);
          showToast("error", result.error);
          return;
        }
      }
      await markOnboarded(supabase, userId);
      // Land on /profile, which resolves the (possibly regenerated) slug and
      // redirects to the tutor's own profile for inline editing.
      router.replace("/profile");
    } catch (e) {
      setSubmitting(false);
      showToast("error", "Something went wrong. Please try again.");
    }
  };

  // Reading width (DESIGN.md §3: onboarding sits at 680px). No pill, no
  // segmented bar, no slide between steps: plain "Step N of 6" text.
  return (
    <div className="bg-surface">
      <div className="max-w-[680px] mx-auto px-4 lg:px-6 pt-8 pb-16">
        {/* Intro */}
        <div className="mb-6">
          <p className="mb-2 text-[14px] leading-5 text-[color:var(--text-2)] tabular-nums" aria-live="polite">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <h1 className="text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-semibold text-[color:var(--text)]">Set up your profile</h1>
          <p className="mt-2 text-[16px] leading-6 text-[color:var(--text-2)]">
            A few quick questions to get you listed. Skip anything you&apos;re not ready for. You can edit it all later on your profile.
          </p>
        </div>

        {/* Step content */}
        <div className="min-h-[280px] border-t border-rule pt-6">
          {step.render({ tutor, set, catalog, schoolCatalog, supabase, persistProfile, showToast })}
        </div>

        {/* Nav */}
        <div className="mt-8 flex items-center justify-end gap-2 border-t border-rule pt-6">
          {!isFirst && (
            <Button variant="ghost" onClick={goBack} disabled={submitting}>
              Back
            </Button>
          )}
          {isLast ? (
            <Button variant="primary" onClick={goNext} disabled={advanceDisabled || submitting}>
              {submitting ? "Finishing…" : "Finish"}
            </Button>
          ) : showNext ? (
            <Button variant="primary" onClick={goNext} disabled={advanceDisabled || submitting}>
              Next
            </Button>
          ) : (
            <Button variant="outline" onClick={goNext} disabled={advanceDisabled || submitting}>
              Skip
            </Button>
          )}
        </div>

        {step.requireName && !nameValid && (
          <p className="mt-2 text-right text-[14px] leading-5 text-[color:var(--text-2)]">
            Enter your full name to continue.
          </p>
        )}
      </div>

      <Toast toast={toast} />
    </div>
  );
}
