"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/Icon";
import { Avatar } from "@/components/ui";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSubjects, getSchools, saveTutorProfile, setTutorVisibility, getMyVerificationStatus } from "@/lib/supabase/tutors";
import { listTutorDocs, signStagedUrls, uploadStagedImage } from "@/lib/supabase/storage";
import { saveProfileDraft, discardProfileDraft } from "@/lib/supabase/profileRevisions";
import { collectStagedPaths, payloadDocsToList, payloadToEditor, resolveImage, stagedPath } from "@/lib/profileRevision";
import { diffProfiles } from "@/lib/profileDiff";
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
import { Section, SidebarHeading, SubjectsCard, DocumentationCard, ServiceAreaCard, cardStyle, formatDelivery, buildCredentialTiles } from "./ProfileCards";
import { ReviewsCard } from "./ReviewsCard";
import { getTutorReviews } from "@/lib/supabase/reviews";
import { OwnerCard } from "./OwnerCard";
import { RevealStack } from "./RevealStack";

/**
 * Inline profile editor — the LinkedIn-style replacement for /settings. Renders
 * the tutor's own public profile from the committed `profile` (editor shape →
 * display shape via editorToDisplay). Each card carries a pen that opens its
 * matching settings section form; **each section saves independently** (Save /
 * Cancel live inside the card) — there is no global save bar and no top banner.
 * Only one section is open at a time, so a save never clobbers another section.
 *
 * VERIFIED tutors (`editorTutor.gated`, 0072) edit a reviewed DRAFT instead:
 * every section Save writes the whole draft through saveProfileDraft, new
 * photos and documents go to private staging, and nothing reaches the live
 * profile until an admin approves a submission. `revision` is their open draft
 * or submission from the server (null when there is none). `profile` then holds
 * the draft and `live` the approved profile; the owner card switches the page
 * between them (Live is read-only) and offers Submit / Discard / Resend.
 */
export function OwnerProfile({ editorTutor, userId, revision = null }) {
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
  const supabase = supabaseRef.current;

  const gated = !!editorTutor.gated;
  const [initialProfile] = useState(() =>
    gated && revision ? payloadToEditor(revision.payload, editorTutor) : editorTutor
  );
  const [live, setLive] = useState(editorTutor);       // approved profile (differs from `profile` only when gated)
  const [profile, setProfile] = useState(initialProfile); // committed/saved truth (the draft, when gated)
  const [editingKey, setEditingKey] = useState(null);  // open section, or null
  const [draft, setDraft] = useState(initialProfile);   // working copy of open section
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
  // Reviews aren't part of the profile row (or editable), so they load
  // separately and render read-only — the tutor sees what students see.
  const [reviews, setReviews] = useState([]);
  // The section whose Save is waiting on confirmation, or null: "this will
  // withdraw your verification request" (pending tutors) or "this will take
  // your changes out of review" (verified tutors with a submission).
  const [confirmKey, setConfirmKey] = useState(null);

  // Verified tutors' draft state (0072).
  const [rev, setRev] = useState(revision);           // { id, status, submittedAt, adminNotifiedAt, rejected, rejectedReason } | null
  const [draftDocs, setDraftDocs] = useState(null);   // the draft's documentation list; null = same as live
  const [signed, setSigned] = useState({});           // staged path -> signed preview URL
  const [viewMode, setViewMode] = useState("draft");  // "draft" | "live"
  const [busy, setBusy] = useState(null);             // "submit" | "discard" | "resend" | null
  const [docsLoaded, setDocsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getSubjects(supabase).then((rows) => { if (active) setSubjectCatalog(rows); });
    getSchools(supabase).then((rows) => { if (active) setSchoolCatalog(rows); });
    getTutorReviews(supabase, userId).then((rows) => { if (active) setReviews(rows); });
    // Live documents, plus (for a verified tutor's draft) signed previews of
    // its staged files and the draft's own documentation list.
    const staged = gated && revision ? collectStagedPaths(revision.payload) : [];
    Promise.all([listTutorDocs(supabase, userId), signStagedUrls(supabase, staged)]).then(([rows, urls]) => {
      if (!active) return;
      setDocs(rows);
      setSigned(urls);
      if (gated && Array.isArray(revision?.payload?.documents)) {
        setDraftDocs(payloadDocsToList(revision.payload, rows, urls));
      }
      setDocsLoaded(true);
    });
    return () => { active = false; };
    // `revision` / `gated` are the server's initial values; later changes are
    // local state, so this runs once per tutor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setConfirmKey(null);
    setEditingKey(k);
  };
  const cancel = () => {
    setEditingKey(null);
    setConfirmKey(null);
    setDocsDirty(false); // the documentation draft unmounts with its modal
  };

  // A pending verification request covers the profile as the admin will see
  // it, so a real change withdraws it (0072). Likewise a verified tutor's
  // submission under review: editing takes it out of review. Ask once per save
  // before doing either; returns true when the save may go ahead now.
  const pending = profile.verificationStatus === "pending";
  const underReview = gated && rev?.status === "pending";
  const confirmText = underReview
    ? "Your changes are under review. Saving this will take them out of review, and you'll need to submit again."
    : "Your verification request is being reviewed. Saving this change will withdraw it, and you can request again once you're done editing.";
  const confirmWithdraw = (k) => {
    if (!(pending || underReview) || confirmKey === k) return true;
    setConfirmKey(k);
    return false;
  };
  const WITHDRAWN_TOAST = "Saved. Your verification request was withdrawn, so request it again when you're ready.";

  // --- Verified tutors: the reviewed draft -----------------------------------
  const currentDraftDocs = draftDocs ?? docs;

  // After any draft save: the open revision is now an unsubmitted draft. A
  // submission that was under review was withdrawn by the save (0072).
  const afterDraftSave = (result) => {
    setRev((r) => ({
      ...(r ?? {}),
      id: result.revisionId,
      status: "draft",
      submittedAt: result.withdrewSubmission ? null : r?.submittedAt ?? null,
      rejected: result.withdrewSubmission ? false : !!r?.rejected,
      rejectedReason: result.withdrewSubmission ? null : r?.rejectedReason ?? null,
    }));
    showToast(
      "ok",
      result.withdrewSubmission
        ? "Saved to your draft. It was taken out of review, so submit again when you're ready."
        : "Saved to your draft",
      result.withdrewSubmission ? 5000 : 1800
    );
  };

  const uploadStaged = async (file, kind) => {
    const r = await uploadStagedImage(supabase, userId, kind, file);
    if (!r.ok) return { ok: false, error: r.error };
    const path = stagedPath(r.value);
    if (path && r.previewUrl) setSigned((m) => ({ ...m, [path]: r.previewUrl }));
    return { ok: true, url: r.value };
  };
  const resolveImg = (value) => resolveImage(value, signed);

  const onSubmitRevision = async () => {
    setBusy("submit");
    try {
      const res = await fetch("/api/profile-revisions/submit", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data?.error || "Couldn't submit. Please try again.", 4000);
        return;
      }
      setRev((r) => ({ ...r, status: "pending", submittedAt: data.submittedAt, adminNotifiedAt: data.adminNotifiedAt, rejected: false, rejectedReason: null }));
      showToast("ok", "Submitted for review. We'll email you once it's checked.", 3500);
    } catch {
      showToast("error", "Network error. Please try again.", 3500);
    } finally {
      setBusy(null);
    }
  };

  const onResendRevision = async () => {
    setBusy("resend");
    try {
      const res = await fetch("/api/profile-revisions/resend", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data?.error || "Couldn't resend. Please try again.", 4000);
        return;
      }
      setRev((r) => ({ ...r, adminNotifiedAt: data.adminNotifiedAt }));
      showToast("ok", "Sent to the reviewer again", 2500);
    } catch {
      showToast("error", "Network error. Please try again.", 3500);
    } finally {
      setBusy(null);
    }
  };

  const onDiscardRevision = async () => {
    setBusy("discard");
    const r = await discardProfileDraft(supabase);
    setBusy(null);
    if (!r.ok) {
      showToast("error", r.error?.message || "Couldn't discard. Please try again.", 4000);
      return;
    }
    setProfile(live);
    setDraft(live);
    setDraftDocs(null);
    setRev(null);
    setViewMode("draft");
    showToast("ok", "Changes discarded", 1800);
  };
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const dirty = useMemo(
    () => editingKey != null && JSON.stringify(draft) !== JSON.stringify(profile),
    [editingKey, draft, profile]
  );

  const saveSection = async (k) => {
    if (savingKey) return;
    if (!confirmWithdraw(k)) return;
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
    if (gated) {
      if (!docsLoaded) {
        showToast("warn", "Still loading your documents. Try again in a moment.", 3000);
        return;
      }
      setSavingKey(k);
      const result = await saveProfileDraft(supabase, toSave, currentDraftDocs);
      setSavingKey(null);
      if (!result.ok) {
        console.error("[profile] draft save failed:", result.error);
        showToast("error", result.error?.message || "Save failed. Please try again.", 4000);
        return;
      }
      setProfile(toSave);
      setEditingKey(null);
      setConfirmKey(null);
      afterDraftSave(result);
      return;
    }
    setSavingKey(k);
    const result = await saveTutorProfile(supabase, userId, toSave);
    setSavingKey(null);
    if (!result.ok) {
      console.error("[profile] save failed:", result.error);
      showToast("error", result.error?.message || "Save failed. Please try again.", 4000);
      return;
    }
    const verificationStatus = result.verificationWithdrawn ? "none" : profile.verificationStatus;
    setProfile({ ...toSave, verificationStatus });
    setEditingKey(null);
    setConfirmKey(null);
    if (result.verificationWithdrawn) {
      showToast("warn", WITHDRAWN_TOAST, 6000);
    } else if (result.droppedSubjects.length > 0) {
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
    if (!confirmWithdraw("documentation")) return;
    if (gated) {
      // Draft mode: commit() only uploads new files to private staging and
      // returns the list; the list is then saved into the draft.
      setSavingKey("documentation");
      const result = await docsEditorRef.current?.commit();
      if (!result) {
        setSavingKey(null);
        showToast("error", "Save failed. Please try again.", 4000);
        return;
      }
      const saved = await saveProfileDraft(supabase, profile, result.docs);
      setSavingKey(null);
      if (!saved.ok) {
        showToast("error", saved.error?.message || "Save failed. Please try again.", 4000);
        return;
      }
      setSigned((m) => {
        const next = { ...m };
        for (const d of result.docs) if (d.stagedPath && d.url) next[d.stagedPath] = d.url;
        return next;
      });
      setDraftDocs(result.docs);
      setDocsDirty(false);
      setEditingKey(null);
      setConfirmKey(null);
      if (result.errors.length > 0) {
        showToast("warn", `Saved to your draft, with issues: ${result.errors.map((e) => `${e.name} (${e.message})`).join("; ")}`, 6000);
        setRev((r) => ({ ...(r ?? {}), id: saved.revisionId, status: "draft" }));
      } else {
        afterDraftSave(saved);
      }
      return;
    }
    setSavingKey("documentation");
    const result = await docsEditorRef.current?.commit();
    // The document RPCs withdraw a pending request themselves but return no
    // flag, so re-read the status to find out.
    const withdrawn = pending && (await getMyVerificationStatus(supabase, userId)) === "none";
    setSavingKey(null);
    if (!result) {
      showToast("error", "Save failed. Please try again.", 4000);
      return;
    }
    setDocs(result.docs);
    setDocsDirty(false);
    setEditingKey(null);
    setConfirmKey(null);
    if (withdrawn) setProfile((p) => ({ ...p, verificationStatus: "none" }));
    if (withdrawn) {
      showToast("warn", WITHDRAWN_TOAST, 6000);
    } else if (result.errors.length > 0) {
      showToast("warn", `Saved, with issues: ${result.errors.map((e) => `${e.name} (${e.message})`).join("; ")}`, 6000);
    } else {
      showToast("ok", "Section saved", 1600);
    }
  };

  // Visibility lives in the owner card and has no section editor, so it persists
  // immediately through its own RPC (only the visibility column changes). Keep
  // any open draft in sync so a later section save doesn't revert it.
  const onVisibilityChange = async (value) => {
    const result = await setTutorVisibility(supabase, value);
    if (!result.ok) {
      showToast("error", result.error?.message || "Couldn't update visibility.", 3500);
      return false;
    }
    setProfile((p) => ({ ...p, visibility: value }));
    setLive((p) => ({ ...p, visibility: value }));
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
    const onKey = (e) => { if (e.key === "Escape") { setEditingKey(null); setConfirmKey(null); setDocsDirty(false); } };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [editingKey]);

  // What the page shows: the draft (editable) or, for a verified tutor who
  // flipped the toggle, the live profile (read-only).
  const showingLive = gated && viewMode === "live";
  const shown = showingLive ? live : profile;
  const shownDocs = showingLive ? docs : gated ? currentDraftDocs : docs;
  const display = useMemo(() => {
    const d = editorToDisplay(shown, subjectCatalog);
    if (!gated) return d;
    return { ...d, avatarImg: resolveImage(shown.avatarImg, signed), bannerImg: resolveImage(shown.bannerImg, signed) };
  }, [shown, subjectCatalog, gated, signed]);

  const hasDraftChanges = useMemo(
    () =>
      gated && rev
        ? diffProfiles({ live, draft: profile, liveDocs: docs, draftDocs: currentDraftDocs, subjectCatalog }).length > 0
        : false,
    [gated, rev, live, profile, docs, currentDraftDocs, subjectCatalog]
  );
  const reviewState = !gated
    ? null
    : !rev
      ? "live"
      : rev.status === "pending"
        ? "pending"
        : rev.rejected
          ? "rejected"
          : hasDraftChanges
            ? "draft"
            : "live";
  const review = gated
    ? {
        state: reviewState,
        submittedAt: rev?.submittedAt ?? null,
        adminNotifiedAt: rev?.adminNotifiedAt ?? null,
        reason: rev?.rejectedReason ?? null,
        viewMode: reviewState === "live" ? "draft" : viewMode,
        onViewMode: (m) => { if (!editingKey) setViewMode(m); },
        onSubmit: onSubmitRevision,
        onDiscard: onDiscardRevision,
        onResend: onResendRevision,
        busy,
      }
    : null;
  const credTiles = buildCredentialTiles(display.credentials);

  const publicHref = `matchtutor.com.au/tutor/${profile.slug || userId}`;
  const publicUrl = `https://${publicHref}`;

  // Rendered twice (mobile under the header, desktop at the top of the sidebar)
  // so the completion/verification nudge leads on phones instead of sitting
  // below all the profile content when the grid collapses to one column.
  const ownerCard = (
    <OwnerCard
      profile={profile}
      onVisibilityChange={onVisibilityChange}
      onVerificationRequested={(status) => setProfile((p) => ({ ...p, verificationStatus: status }))}
      review={review}
      publicHref={publicHref}
      publicUrl={publicUrl}
    />
  );

  const regionProps = (k, label, maxW = 760) => ({
    label,
    maxW,
    editing: editingKey === k,
    saving: savingKey === k,
    // Only the open section renders its modal, so the shared `dirty` (draft vs
    // committed profile) is exactly this section's unsaved state.
    dirty,
    confirming: confirmKey === k,
    confirmText,
    readOnly: showingLive,
    onKeepEditing: () => setConfirmKey(null),
    onEdit: () => openSection(k),
    onCancel: cancel,
    onSave: () => saveSection(k),
  });

  // Header view — flat, like every other card on the page.
  const headerView = (
    <div className="relative bg-[color:var(--paper-card)] overflow-hidden" style={cardStyle}>
      <div
        style={{
          height: 150,
          background: display.bannerImg
            ? `url(${display.bannerImg}) center / cover no-repeat`
            : `linear-gradient(135deg, ${display.bannerBg ?? display.avatarBg}, oklch(0.96 0.01 250))`,
        }}
      />
      <div className="px-7 pb-[22px]" style={{ marginTop: -54 }}>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <Avatar tutor={display} size={108} ring />
        </div>
        <ProfileHeaderText tutor={display} deliveryLabel={formatDelivery(display)} />
      </div>
    </div>
  );

  return (
    <div className="bg-[color:var(--paper-card)] bleed-under-nav relative overflow-hidden pb-24">
      <DeskBackdrop />
      <div className="relative z-10 max-w-[1128px] mx-auto px-6 pt-6">
        <RevealStack>
        <EditRegion
          {...regionProps("header", "profile header", 1100)}
          view={headerView}
          edit={
            <div>
              <h2 className="text-[18px] font-light text-slate-800 tracking-tight">Profile header</h2>
              <p className="text-[13px] text-slate-500 mt-1 mb-5">The banner, photo and intro at the top of your profile.</p>
              <BannerAvatarSection
                tutor={draft}
                set={set}
                supabase={supabase}
                bare
                uploadImage={gated ? uploadStaged : undefined}
                resolveImage={gated ? resolveImg : undefined}
              />
              <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--desk)" }}>
                <IdentitySection tutor={draft} set={set} bare />
              </div>
              <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--desk)" }}>
                <YearLevelsSection tutor={draft} set={set} bare />
              </div>
            </div>
          }
        />
        </RevealStack>

        {/* Mobile only: "Your profile" card sits directly under the header,
            above the profile content. On desktop it lives at the top of the
            right sidebar (below), so it's hidden here. */}
        <div className="lg:hidden mt-[10px]">{ownerCard}</div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[10px] mt-[10px] items-start">
          <RevealStack className="space-y-[10px] min-w-0" delayChildren={0.12}>
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
          </RevealStack>

          <RevealStack as="aside" className="space-y-[10px]" delayChildren={0.12}>
            <div className="hidden lg:block">{ownerCard}</div>

            <EditRegion
              {...regionProps("rate", "rate", 480)}
              view={<RateCard tutor={display} showMessage={false} />}
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
              view={shownDocs.length > 0
                ? <DocumentationCard docs={shownDocs.map((d) => ({ ...d, path: d.path || d.stagedPath || "" }))} />
                : <MiniCard title="Documentation"><EmptyHint>Share documents that back up your credentials, like your WWCC, transcripts and certificates.</EmptyHint></MiniCard>}
              edit={
                <DocumentationUploader
                  ref={docsEditorRef}
                  userId={userId}
                  docs={gated ? currentDraftDocs : docs}
                  onDirtyChange={setDocsDirty}
                  mode={gated ? "draft" : "live"}
                />
              }
            />

            {/* Read-only: reviews are written by students and moderated, so
                there is nothing here for the owner to edit. Sits in the same
                sidebar slot as on the public profile. */}
            <ReviewsCard tutorId={userId} tutorName={display.name} rating={display.rating} reviewCount={display.reviews} reviews={reviews} />

            <EditRegion
              {...regionProps("serviceArea", "service area", 520)}
              view={(display.serviceArea?.suburb || display.suburb)
                ? <ServiceAreaCard tutor={display} />
                : <MiniCard title="Service area"><EmptyHint>Set the suburb you travel to for in-person lessons.</EmptyHint></MiniCard>}
              edit={<ServiceAreaSection tutor={draft} set={set} bare />}
            />
          </RevealStack>
        </div>
      </div>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 text-[13.5px] inline-flex items-center gap-2"
          style={{
            background: toast.kind === "error" ? "#B91C1C" : toast.kind === "warn" ? "#92400E" : "var(--ink)",
            color: "#fff",
            borderRadius: 999,
            boxShadow: "0 10px 30px rgba(0,30,30,0.2)",
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
function EditRegion({ editing, saving, dirty, confirming, confirmText, readOnly, onKeepEditing, onEdit, onCancel, onSave, label, view, edit, maxW = 640 }) {
  // Always render the read-only view; in edit mode it sits (blurred) behind a
  // modal overlay so the page itself stays the preview. The overlay is
  // portaled to <body> so ancestor overflow/transforms can't clip it. The
  // editor is one card with a sticky Save/Cancel action bar at the top-right.
  return (
    <div className="relative">
      {view}
      {!editing && !readOnly && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          title={`Edit ${label}`}
          className="absolute top-3 right-3 z-10 inline-flex items-center justify-center transition-colors hover:bg-slate-100"
          style={{ width: 32, height: 32, borderRadius: 999, background: "var(--paper-card)", color: "var(--ink-muted)", border: "1px solid var(--paper-line)" }}
        >
          <Icon name="pencil" size={14} strokeWidth={2} />
        </button>
      )}
      {editing && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6"
          style={{ background: "rgba(0,49,47,0.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${label}`}
        >
          <div
            className="w-full flex flex-col bg-[color:var(--paper-card)]"
            style={{ maxWidth: maxW, maxHeight: "88vh", border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", boxShadow: "0 30px 80px -40px rgba(0,30,30,0.35)" }}
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
                {saving ? "Saving…" : (<><Icon name="check" size={13} strokeWidth={2.4} /> {confirming ? "Save anyway" : "Save"}</>)}
              </button>
            </div>
            {/* Shown when a verification request is pending: saving a change
                withdraws it, so the first Save asks and the second confirms. */}
            {confirming && (
              <div
                role="alert"
                className="shrink-0 flex items-start gap-2.5 px-5 sm:px-6 py-3 text-[12.5px]"
                style={{ background: "#FFFBEB", color: "#92400E", borderBottom: "1px solid #FDE68A" }}
              >
                <span className="shrink-0 mt-0.5"><Icon name="alert-triangle" size={14} /></span>
                <span className="flex-1 leading-[1.5]">{confirmText}</span>
                <button
                  type="button"
                  onClick={onKeepEditing}
                  className="shrink-0 font-medium underline underline-offset-2"
                >
                  Keep editing
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">
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
    <div className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "18px 20px" }}>
      <SidebarHeading>{title}</SidebarHeading>
      <div className="mt-3">{children}</div>
    </div>
  );
}
