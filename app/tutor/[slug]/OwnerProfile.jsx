"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { Toast, useToast } from "@/components/Toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSubjects, getSchools, saveTutorProfile, setTutorVisibility, getMyVerificationStatus } from "@/lib/supabase/tutors";
import { adminTutorWriter } from "@/lib/admin/managedTutorWriter";
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
import { ProfileHeader } from "./PublicProfileView";
import { AboutCard } from "./AboutCard";
import { RateCard } from "./RateCard";
import { CredentialsList } from "./CredentialsList";
import { ExperienceTimeline } from "./ExperienceTimeline";
import { EducationTimeline } from "./EducationTimeline";
import { AvailabilityGrid } from "./AvailabilityGrid";
import { Section, SubjectsCard, DocumentationCard, ServiceAreaCard, buildCredentialTiles } from "./ProfileCards";
import { ReviewsCard } from "./ReviewsCard";
import { getTutorReviews } from "@/lib/supabase/reviews";
import { OwnerCard } from "./OwnerCard";

/**
 * Inline profile editor (REDESIGN_DECISIONS.md item 7, lead reference LinkedIn).
 * Renders the tutor's own profile in the SAME layout as the public view
 * (PublicProfileView: ProfileHeader, flat main-column sections, the contact
 * column on the right) from the committed `profile` (editor shape to display
 * shape via editorToDisplay). Each section carries a 44px pen that opens its
 * form in the shared Modal (a full-screen sheet below 640px); **each section
 * saves independently** (Cancel / Save in the modal footer). Only one section
 * is open at a time, so a save never clobbers another section.
 *
 * VERIFIED tutors (`editorTutor.gated`, 0072) edit a reviewed DRAFT instead:
 * every section Save writes the whole draft through saveProfileDraft, new
 * photos and documents go to private staging, and nothing reaches the live
 * profile until an admin approves a submission. `revision` is their open draft
 * or submission from the server (null when there is none). `profile` then holds
 * the draft and `live` the approved profile; the owner card switches the page
 * between them (Live is read-only) and offers Submit / Discard / Resend.
 *
 * ADMIN mode (`admin` set, 0076): an admin editing a tutor who consented to
 * being managed, from /admin/tutor-invites/[id]/edit. Same editor, but every
 * save is LIVE and goes through the /api/admin/managed-tutors routes
 * (adminTutorWriter), since the admin's own session cannot write another
 * tutor's rows or storage folders. No draft, no verification prompts.
 */
export function OwnerProfile({ editorTutor, userId, revision = null, admin = null }) {
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
  const supabase = supabaseRef.current;
  const writer = useMemo(() => (admin ? adminTutorWriter(userId) : null), [admin, userId]);

  // An admin edits the live profile directly, so the draft machinery is off.
  const gated = !admin && !!editorTutor.gated;
  const [initialProfile] = useState(() =>
    gated && revision ? payloadToEditor(revision.payload, editorTutor) : editorTutor
  );
  const [live, setLive] = useState(editorTutor);       // approved profile (differs from `profile` only when gated)
  const [profile, setProfile] = useState(initialProfile); // committed/saved truth (the draft, when gated)
  const [editingKey, setEditingKey] = useState(null);  // open section, or null
  const [draft, setDraft] = useState(initialProfile);   // working copy of open section
  const [savingKey, setSavingKey] = useState(null);
  const [toast, pushToast] = useToast();
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

  // Same (kind, text, ms) calls as before; the shared Toast names the kinds
  // success / warning / error.
  const showToast = (kind, text, ms = 2200) =>
    pushToast(kind === "ok" ? "success" : kind === "warn" ? "warning" : kind, text, ms);

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
  // Only a LIVE save withdraws a request: a gated tutor's save goes to a draft,
  // and a managed tutor (0076) can be gated while still pending.
  const pending = !admin && !gated && profile.verificationStatus === "pending";
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
    const result = writer ? await writer.saveProfile(toSave) : await saveTutorProfile(supabase, userId, toSave);
    setSavingKey(null);
    if (!result.ok) {
      console.error("[profile] save failed:", result.error);
      showToast("error", result.error?.message || "Save failed. Please try again.", 4000);
      return;
    }
    const verificationStatus = result.verificationWithdrawn ? "none" : profile.verificationStatus;
    // Admin mode: adopt the profile's new version, sent back with the next save.
    setProfile({ ...toSave, verificationStatus, ...(result.updatedAt ? { updatedAt: result.updatedAt } : {}) });
    setEditingKey(null);
    setConfirmKey(null);
    if (result.verificationWithdrawn) {
      showToast("warn", WITHDRAWN_TOAST, 6000);
    } else if (result.droppedSubjects.length > 0) {
      const bySlug = new Map(subjectCatalog.map((s) => [s.slug, s]));
      const labels = result.droppedSubjects.map((slug) => subjectLabel(bySlug.get(slug) ?? { name: slug }));
      showToast("warn", `Saved. Skipped unrecognised subjects: ${labels.join(", ")}.`, 5000);
    } else {
      showToast("ok", writer ? "Saved. The tutor has been emailed the change." : "Section saved", writer ? 2600 : 1600);
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
    // Admin mode: the per-document calls were quiet; tell the tutor about the
    // whole save in one email (`docs` is still the list the editor opened with).
    if (writer && result) await writer.docs.notify(docs);
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
      showToast("ok", writer ? "Saved. The tutor has been emailed the change." : "Section saved", writer ? 2600 : 1600);
    }
  };

  // Visibility lives in the owner card and has no section editor, so it persists
  // immediately through its own RPC (only the visibility column changes). Keep
  // any open draft in sync so a later section save doesn't revert it.
  const onVisibilityChange = async (value) => {
    const result = writer ? await writer.setVisibility(value) : await setTutorVisibility(supabase, value);
    if (!result.ok) {
      showToast("error", result.error?.message || "Couldn't update visibility.", 3500);
      return false;
    }
    // Admin mode: visibility moved the profile's version too (see saveSection).
    const version = result.updatedAt ? { updatedAt: result.updatedAt } : {};
    setProfile((p) => ({ ...p, visibility: value, ...version }));
    setLive((p) => ({ ...p, visibility: value, ...version }));
    setDraft((d) => ({ ...d, visibility: value, ...version }));
    return true;
  };

  useEffect(() => {
    const h = (e) => { if (dirty || docsDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, docsDirty]);

  // While a section editor is open it renders in the shared Modal, which owns
  // the (reference-counted) scroll lock. Escape closes it, as before; the
  // Modal itself is non-dismissable so a stray scrim click can't drop edits.
  // A dialog stacked on top (the image crop) handles its own Escape, so this
  // one only reacts when it is the only dialog open.
  useEffect(() => {
    if (!editingKey) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
      setEditingKey(null); setConfirmKey(null); setDocsDirty(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  // Rendered once, at the top of the right column. The column comes first in
  // source order, so below 1024px the verification notice and checklist sit
  // directly under the header, ahead of the profile content.
  const ownerCard = (
    <OwnerCard
      profile={profile}
      onVisibilityChange={onVisibilityChange}
      onVerificationRequested={(status) => setProfile((p) => ({ ...p, verificationStatus: status }))}
      review={review}
      publicHref={publicHref}
      publicUrl={publicUrl}
      adminMode={!!admin}
    />
  );

  const regionProps = (k, label, maxW = 680) => ({
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

  return (
    <div className="bg-surface">
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-6 pb-16">
        {admin && (
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded border border-rule px-4 py-3 text-[14px] leading-5 text-[color:var(--text)]">
            <span className="min-w-0 flex-1">
              Editing as admin. Every save goes live straight away and emails the tutor what changed.
            </span>
            {admin.backHref && (
              <a href={admin.backHref} className="inline-flex min-h-6 items-center font-semibold text-accent hover:text-accent-hover">
                Back to dashboard
              </a>
            )}
          </div>
        )}

        {/* The same header as the public view; its top-right slot holds the pen. */}
        <EditRegion
          {...regionProps("header", "profile header", 680)}
          view={(pen) => <ProfileHeader tutor={display} action={pen} />}
          edit={
            <div>
              <p className="mb-6 text-[14px] leading-5 text-[color:var(--text-2)]">
                Your photo, banner and the details at the top of your profile.
              </p>
              <BannerAvatarSection
                tutor={draft}
                set={set}
                supabase={supabase}
                bare
                uploadImage={gated ? uploadStaged : writer ? writer.uploadImage : undefined}
                resolveImage={gated ? resolveImg : undefined}
              />
              <div className="mt-6 border-t border-rule pt-6">
                <IdentitySection tutor={draft} set={set} bare />
              </div>
              <div className="mt-6 border-t border-rule pt-6">
                <YearLevelsSection tutor={draft} set={set} bare />
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_344px] lg:gap-x-12">
          <aside className="lg:col-start-2 lg:row-start-1">
            {ownerCard}
            <div className="pt-6">
              <EditRegion
                {...regionProps("rate", "rate and packages", 560)}
                penClass="right-0 top-0 lg:right-2 lg:top-2"
                view={<RateCard tutor={display} showMessage={false} />}
                edit={<RateSection tutor={draft} set={set} bare hideTitle />}
              />
            </div>
          </aside>

          {/* Same order as the public view's main column. Empty sections stay
              visible here (with one line saying what goes in them) so there is
              always a pen to start from. */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <EditRegion
              {...regionProps("about", "about")}
              view={display.bioLong
                ? <AboutCard text={display.bioLong} />
                : <Section title="About"><EmptyHint>Tell students about your teaching approach.</EmptyHint></Section>}
              edit={<AboutSection tutor={draft} set={set} bare hideTitle />}
            />

            <EditRegion
              {...regionProps("subjects", "subjects", 560)}
              view={display.subjects.length > 0
                ? <SubjectsCard subjects={display.subjects} />
                : <Section title="Subjects"><EmptyHint>Add the subjects you tutor.</EmptyHint></Section>}
              edit={<SubjectsSection tutor={draft} set={set} catalog={subjectCatalog} bare hideTitle />}
            />

            <EditRegion
              {...regionProps("credentials", "credentials")}
              view={
                <Section title="Credentials">
                  {credTiles.length > 0 ? <CredentialsList tiles={credTiles} /> : <EmptyHint>Add your ATAR, awards, degrees or state ranks.</EmptyHint>}
                </Section>
              }
              edit={<CredentialsSection tutor={draft} set={set} bare hideTitle />}
            />

            {/* Documentation saves to Storage + tutor_documents (not the
                profile row), so this region overrides dirty/onSave with the
                doc editor's own draft state and commit(). */}
            <EditRegion
              {...regionProps("documentation", "documents", 560)}
              dirty={docsDirty}
              onSave={saveDocumentation}
              view={shownDocs.length > 0
                ? <DocumentationCard docs={shownDocs.map((d) => ({ ...d, path: d.path || d.stagedPath || "" }))} />
                : <Section title="Documents"><EmptyHint>Share documents that back up your credentials, like your WWCC, transcripts and certificates.</EmptyHint></Section>}
              edit={
                <DocumentationUploader
                  ref={docsEditorRef}
                  userId={userId}
                  docs={gated ? currentDraftDocs : docs}
                  onDirtyChange={setDocsDirty}
                  mode={gated ? "draft" : "live"}
                  ops={writer?.docs}
                  hideTitle
                />
              }
            />

            <EditRegion
              {...regionProps("education", "education")}
              view={
                <Section title="Education">
                  {display.education.length > 0 ? <EducationTimeline education={display.education} /> : <EmptyHint>Add your high school and university.</EmptyHint>}
                </Section>
              }
              edit={<EducationSection tutor={draft} set={set} schoolCatalog={schoolCatalog} bare hideTitle />}
            />

            <EditRegion
              {...regionProps("experience", "experience")}
              view={
                <Section title="Experience">
                  {display.experience.length > 0 ? <ExperienceTimeline experience={display.experience} /> : <EmptyHint>Add your tutoring or teaching roles.</EmptyHint>}
                </Section>
              }
              edit={<ExperienceSection tutor={draft} set={set} bare hideTitle />}
            />

            {/* Read-only: reviews are written by students and moderated, so
                there is nothing here for the owner to edit. Same slot as on
                the public profile. */}
            <ReviewsCard tutorId={userId} tutorName={display.name} rating={display.rating} reviewCount={display.reviews} reviews={reviews} />

            <EditRegion
              {...regionProps("availability", "availability")}
              view={
                <Section title="Availability" subtitle="Times you're usually free each week">
                  {display.availability ? <AvailabilityGrid availability={display.availability} /> : <EmptyHint>Set your weekly availability.</EmptyHint>}
                </Section>
              }
              edit={<AvailabilitySection tutor={draft} set={set} bare hideTitle />}
            />

            <EditRegion
              {...regionProps("serviceArea", "location", 560)}
              view={(display.serviceArea?.suburb || display.suburb)
                ? <ServiceAreaCard tutor={display} />
                : <Section title="Location"><EmptyHint>Set the suburb you travel to for in-person lessons.</EmptyHint></Section>}
              edit={<ServiceAreaSection tutor={draft} set={set} bare hideTitle />}
            />
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  );
}

/**
 * Wraps a profile section with inline editing (LinkedIn pen + modal). In view
 * mode a 44px pen sits at the section's top right; in edit mode the section's
 * form opens in the shared Modal (`sheet`: full screen below 640px) titled
 * "Edit <section>", with Cancel and Save in the footer. Save persists only
 * this section (the parent's saveSection). The page itself stays visible
 * behind the plain scrim, so it remains the preview.
 *
 * `view` may be a function of the pen, for a section with its own slot for it
 * (the profile header's top-right action).
 */
function EditRegion({ editing, saving, dirty, confirming, confirmText, readOnly, onKeepEditing, onEdit, onCancel, onSave, label, view, edit, maxW = 680, penClass = "right-0 top-4" }) {
  const pen = !readOnly ? (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit ${label}`}
      title={`Edit ${label}`}
      className="inline-flex h-11 w-11 items-center justify-center rounded text-[color:var(--text-2)] hover:bg-surface-2 hover:text-[color:var(--text)]"
      style={{ transition: "background-color 120ms ease-out, color 120ms ease-out" }}
    >
      <Icon name="pencil" size={20} />
    </button>
  ) : null;
  const custom = typeof view === "function";
  return (
    <div className="relative">
      {custom ? view(pen) : view}
      {!custom && pen && <div className={`absolute z-10 ${penClass}`}>{pen}</div>}
      {editing && (
        <Modal
          title={`Edit ${label}`}
          onClose={onCancel}
          dismissable={false}
          sheet
          width={maxW}
          footer={
            <>
              {/* Shown when a verification request (or a submission) is under
                  review: saving withdraws it, so the first Save asks and the
                  second confirms. */}
              {confirming && (
                <p role="alert" className="flex w-full items-start gap-2 text-[14px] leading-5 text-[color:var(--text)]">
                  <span className="flex h-5 shrink-0 items-center text-warning"><Icon name="alert-triangle" size={16} /></span>
                  <span>{confirmText}</span>
                </p>
              )}
              <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
              {confirming && (
                <Button variant="ghost" onClick={onKeepEditing} disabled={saving}>Keep editing</Button>
              )}
              <Button variant="primary" onClick={onSave} disabled={saving || !dirty}>
                {saving ? "Saving…" : confirming ? "Save anyway" : "Save"}
              </Button>
            </>
          }
        >
          {edit}
        </Modal>
      )}
    </div>
  );
}

// An empty section: one line in --text-2 (DESIGN.md "Empty state"); the pen
// beside the heading is the action.
function EmptyHint({ children }) {
  return <p className="text-[14px] leading-5 text-[color:var(--text-2)]">{children}</p>;
}
