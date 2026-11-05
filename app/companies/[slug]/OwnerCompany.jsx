"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { Toast, useToast } from "@/components/Toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { saveCompanyProfile } from "@/lib/supabase/companies";
import { getSubjects } from "@/lib/supabase/tutors";
import { ReviewsCard } from "@/app/tutor/[slug]/ReviewsCard";
import { Section } from "@/app/tutor/[slug]/ProfileCards";
import {
  CompanyImagesSection,
  CompanyIdentitySection,
  CompanyAboutSection,
  CompanyRateSection,
  CompanyLocationSection,
} from "@/components/profile-edit/company-sections";
import {
  CompanyHeaderCard,
  CompanyAboutCard,
  CompanyRateCard,
  CompanyLocationCard,
  CompanyTutorsCard,
} from "./CompanyCards";
import { CompanyTutorsEditor } from "./CompanyTutorsEditor";

/**
 * Inline company editor, the company counterpart of OwnerProfile. Renders the
 * company's own public page from the committed `company`, in the SAME layout
 * as the public page (REDESIGN_DECISIONS.md item 6), with a 44px pen on each
 * section that opens its form in the shared Modal (a full-screen sheet below
 * 640px). **Each section saves
 * independently**, and only one is open at a time, so a save can never clobber
 * another section's unsaved work.
 *
 * Deliberately mirrors OwnerProfile's structure rather than abstracting a
 * shared shell: the two subjects share almost no fields, and a premature
 * abstraction here would couple the tutor editor to the company editor for the
 * sake of ~60 lines of scaffolding.
 */
export function OwnerCompany({ initialCompany, initialTutors, initialReviews, userId }) {
  const router = useRouter();
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
  const supabase = supabaseRef.current;

  const [company, setCompany] = useState(initialCompany); // committed truth
  const [draft, setDraft] = useState(initialCompany);     // working copy
  const [editingKey, setEditingKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [toast, pushToast] = useToast();
  // Tutors are rows in `tutor_profiles`, not part of the companies row, so they
  // are state of their own and their editor persists independently.
  const [tutors, setTutors] = useState(initialTutors ?? []);
  const [subjectCatalog, setSubjectCatalog] = useState([]);

  useEffect(() => {
    let active = true;
    getSubjects(supabase).then((rows) => { if (active) setSubjectCatalog(rows); });
    return () => { active = false; };
  }, [supabase]);

  // Same (kind, text, ms) calls as before, onto the shared Toast. Also handed
  // to CompanyTutorsEditor as `onToast`.
  const showToast = (kind, text, ms = 2200) => pushToast(kind === "ok" ? "success" : kind, text, ms);

  // Opening a section reseeds the draft from committed truth, so an abandoned
  // edit elsewhere can never leak into this one.
  const openSection = (k) => {
    setDraft({ ...company });
    setEditingKey(k);
  };
  const cancel = () => setEditingKey(null);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const dirty = useMemo(
    () => editingKey != null && JSON.stringify(draft) !== JSON.stringify(company),
    [editingKey, draft, company]
  );

  const saveSection = async () => {
    if (savingKey) return;
    if ((draft.name ?? "").trim() === "") {
      showToast("error", "Your company needs a name.", 3500);
      return;
    }
    setSavingKey(editingKey);
    // `company.name` is the committed name, which is how saveCompanyProfile
    // tells a genuine rename from an unrelated edit and avoids churning the
    // public URL on every save.
    const result = await saveCompanyProfile(supabase, draft, company.name);
    setSavingKey(null);
    if (!result.ok) {
      console.error("[company] save failed:", result.error);
      showToast("error", result.error?.message || "Save failed, please try again.", 4000);
      return;
    }
    const saved = { ...draft, slug: result.slug ?? draft.slug };
    setCompany(saved);
    setEditingKey(null);
    showToast("ok", "Section saved", 1600);
    // A rename moves the page, so the URL has to follow it.
    if (result.slug && result.slug !== company.slug) {
      router.replace(`/companies/${result.slug}`);
    }
  };

  // Visibility has no section editor, so it persists immediately from the
  // sidebar. Keep any open draft in sync so a later section save can't revert it.
  const onVisibilityChange = async (value) => {
    const next = { ...company, visibility: value };
    const result = await saveCompanyProfile(supabase, next, company.name);
    if (!result.ok) {
      showToast("error", result.error?.message || "Couldn't update visibility.", 3500);
      return;
    }
    setCompany(next);
    setDraft((d) => ({ ...d, visibility: value }));
    showToast("ok", value === "public" ? "Your page is live." : "Your page is hidden.", 2000);
  };

  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // A section editor renders in the shared Modal, which owns the
  // (reference-counted) scroll lock. Escape closes it, same as OwnerProfile; a
  // dialog stacked on top (the tutor modal, the image crop) handles its own
  // Escape, so this only reacts when it is the only dialog open.
  useEffect(() => {
    if (!editingKey) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
      setEditingKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingKey]);

  const regionProps = (k, label, maxW = 680) => ({
    label,
    maxW,
    editing: editingKey === k,
    saving: savingKey === k,
    // Only the open section renders a modal, so the shared `dirty` is exactly
    // this section's unsaved state.
    dirty,
    onEdit: () => openSection(k),
    onCancel: cancel,
    onSave: saveSection,
  });

  return (
    <div className="bg-surface">
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-6 pb-16">
        <EditRegion
          {...regionProps("header", "company details", 680)}
          penClass={company.bannerImg ? "right-0 top-[136px] sm:top-[176px]" : "right-0 top-0"}
          view={<CompanyHeaderCard company={company} />}
          edit={
            <div>
              <p className="mb-6 text-[14px] leading-5 text-[color:var(--text-2)]">
                The logo, banner and name at the top of your page.
              </p>
              <CompanyImagesSection company={draft} set={set} supabase={supabase} userId={userId} />
              <div className="mt-6 border-t border-rule pt-6">
                <CompanyIdentitySection company={draft} set={set} />
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_344px] lg:gap-x-12">
          {/* The contact column, first in source order so it sits under the
              header below 1024px, as on the public page. Not sticky here: it
              also holds the visibility controls, so it can be taller than the
              viewport. */}
          <aside className="lg:col-start-2 lg:row-start-1">
            <VisibilityCard company={company} onChange={onVisibilityChange} />
            <div className="pt-6">
              <EditRegion
                {...regionProps("rate", "packages", 560)}
                penClass="right-0 top-0 lg:right-2 lg:top-2"
                view={<CompanyRateCard company={company} showEnquire={false} />}
                edit={<CompanyRateSection company={draft} set={set} />}
              />
            </div>
          </aside>

          {/* min-w-0: a 1fr track is minmax(auto, 1fr), so without it the
              column's min-content width (a single long unbroken word in a bio
              is enough) widens the whole grid past the viewport. Same guard as
              /browse and /tutor/[slug]. */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <EditRegion
              {...regionProps("about", "about")}
              view={
                company.bioLong ? (
                  <CompanyAboutCard company={company} />
                ) : (
                  <PlaceholderCard
                    title="About"
                    body="Tell students who you teach and how you teach them."
                  />
                )
              }
              edit={<CompanyAboutSection company={draft} set={set} />}
            />

            <EditRegion
              {...regionProps("tutors", "our tutors", 680)}
              closeOnly
              view={
                tutors.some((t) => t.visibility === "public") ? (
                  <CompanyTutorsCard tutors={tutors} companyName={company.name} />
                ) : (
                  <PlaceholderCard
                    title="Our tutors"
                    body={
                      tutors.length > 0
                        ? "None of your tutors are visible to students right now."
                        : "Add your tutors and they'll show here, and in the main tutor search."
                    }
                  />
                )
              }
              edit={
                <CompanyTutorsEditor
                  companyId={company.id}
                  // provision_partner_tutor inherits the company's visibility,
                  // so a new tutor's local row has to start there too or a
                  // hidden company shows a "public" tutor until reload.
                  companyVisibility={company.visibility}
                  ownerId={userId}
                  tutors={tutors}
                  setTutors={setTutors}
                  supabase={supabase}
                  subjectCatalog={subjectCatalog}
                  onToast={showToast}
                />
              }
            />

            {/* Read-only for the owner: reviews aren't editable by their
                subject, and companies_guard_derived (0067) pins the aggregate
                against a client write regardless. */}
            <ReviewsCard
              companyId={company.id}
              tutorName={company.name}
              rating={company.rating}
              reviewCount={company.reviewCount}
              reviews={initialReviews ?? []}
            />

            <EditRegion
              {...regionProps("location", "location", 560)}
              view={<CompanyLocationCard company={company} />}
              edit={<CompanyLocationSection company={draft} set={set} />}
            />
          </div>
        </div>
      </div>

      {/* Above the stacked tutor modal (z 95): every error in that flow is
          reported here. A fixed wrapper lifts the shared Toast's own layer. */}
      <div className="fixed z-[100]">
        <Toast toast={toast} />
      </div>
    </div>
  );
}

/**
 * Live / hidden switch. Persists immediately rather than through a section
 * editor, because it is one boolean and a Save button would be ceremony.
 * A flat section in the right column, like the tutor owner's.
 */
function VisibilityCard({ company, onChange }) {
  const live = company.visibility === "public";
  return (
    <section className="border-b border-rule py-6">
      <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">Your page</h2>
      <p className="mt-1 text-[14px] leading-5 text-[color:var(--text-2)]">
        {live ? "Live and visible to students." : "Hidden from students."}
      </p>
      <div className="mt-4">
        <Button variant="outline" onClick={() => onChange(live ? "hidden" : "public")}>
          {live ? "Hide my page" : "Make my page live"}
        </Button>
      </div>
      {live && (
        <a
          href={`/companies/${company.slug}`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-6 items-center gap-1 text-[14px] leading-5 font-semibold text-accent hover:text-accent-hover"
          style={{ transition: "color 120ms ease-out" }}
        >
          See what students see <Icon name="external" size={16} />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </section>
  );
}

// An empty section: the heading, then one line in --text-2 (DESIGN.md "Empty
// state"); the pen beside the heading is the action.
function PlaceholderCard({ title, body }) {
  return (
    <Section title={title}>
      <p className="text-[14px] leading-5 text-[color:var(--text-2)]">{body}</p>
    </Section>
  );
}

// Lifted from OwnerProfile.jsx. Kept as a local copy on purpose: it is pure
// presentation with no company/tutor knowledge, and hoisting it into a shared
// module would mean any restyle of one editor silently restyles the other.
// `closeOnly` is a local addition: the tutors panel persists every action as it
// happens (adding a tutor mints an auth user, which cannot be drafted), so it
// gets a single Done button instead of a Cancel/Save pair that would imply
// changes are still pending.
function EditRegion({ editing, saving, dirty, onEdit, onCancel, onSave, label, view, edit, maxW = 680, closeOnly = false, penClass = "right-0 top-4" }) {
  return (
    <div className="relative">
      {view}
      {!editing && (
        <div className={`absolute z-10 ${penClass}`}>
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
        </div>
      )}
      {editing && (
        <Modal
          title={`Edit ${label}`}
          onClose={onCancel}
          dismissable={false}
          sheet
          width={maxW}
          footer={
            closeOnly ? (
              <Button variant="primary" onClick={onCancel}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
                <Button variant="primary" onClick={onSave} disabled={saving || !dirty}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </>
            )
          }
        >
          {edit}
        </Modal>
      )}
    </div>
  );
}
