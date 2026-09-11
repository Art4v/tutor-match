"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { savePartnerProfile } from "@/lib/supabase/partners";
import { getSubjects } from "@/lib/supabase/tutors";
import { cardStyle, SidebarCard } from "@/app/tutor/[slug]/ProfileCards";
import {
  PartnerImagesSection,
  PartnerIdentitySection,
  PartnerAboutSection,
  PartnerRateSection,
  PartnerLocationSection,
} from "@/components/profile-edit/partner-sections";
import {
  PartnerHeaderCard,
  PartnerAboutCard,
  PartnerRateCard,
  PartnerLocationCard,
  PartnerTutorsCard,
} from "./PartnerCards";
import { PartnerTutorsEditor } from "./PartnerTutorsEditor";

/**
 * Inline centre editor, the partner counterpart of OwnerProfile. Renders the
 * partner's own public page from the committed `partner`, with a pen on each
 * card that opens its matching form in a modal. **Each section saves
 * independently**, and only one is open at a time, so a save can never clobber
 * another section's unsaved work.
 *
 * Deliberately mirrors OwnerProfile's structure rather than abstracting a
 * shared shell: the two subjects share almost no fields, and a premature
 * abstraction here would couple the tutor editor to the centre editor for the
 * sake of ~60 lines of scaffolding.
 */
export function OwnerPartner({ initialPartner, initialTutors, userId }) {
  const router = useRouter();
  const supabaseRef = useRef(null);
  if (!supabaseRef.current) supabaseRef.current = createSupabaseBrowserClient();
  const supabase = supabaseRef.current;

  const [partner, setPartner] = useState(initialPartner); // committed truth
  const [draft, setDraft] = useState(initialPartner);     // working copy
  const [editingKey, setEditingKey] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [toast, setToast] = useState(null);
  // Tutors are rows in `tutor_profiles`, not part of the partners row, so they
  // are state of their own and their editor persists independently.
  const [tutors, setTutors] = useState(initialTutors ?? []);
  const [subjectCatalog, setSubjectCatalog] = useState([]);

  useEffect(() => {
    let active = true;
    getSubjects(supabase).then((rows) => { if (active) setSubjectCatalog(rows); });
    return () => { active = false; };
  }, [supabase]);

  const showToast = (kind, text, ms = 2200) => {
    setToast({ kind, text });
    window.clearTimeout(showToast._timer);
    showToast._timer = window.setTimeout(() => setToast(null), ms);
  };

  // Opening a section reseeds the draft from committed truth, so an abandoned
  // edit elsewhere can never leak into this one.
  const openSection = (k) => {
    setDraft({ ...partner });
    setEditingKey(k);
  };
  const cancel = () => setEditingKey(null);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const dirty = useMemo(
    () => editingKey != null && JSON.stringify(draft) !== JSON.stringify(partner),
    [editingKey, draft, partner]
  );

  const saveSection = async () => {
    if (savingKey) return;
    if ((draft.name ?? "").trim() === "") {
      showToast("error", "Your centre needs a name.", 3500);
      return;
    }
    setSavingKey(editingKey);
    // `partner.name` is the committed name, which is how savePartnerProfile
    // tells a genuine rename from an unrelated edit and avoids churning the
    // public URL on every save.
    const result = await savePartnerProfile(supabase, draft, partner.name);
    setSavingKey(null);
    if (!result.ok) {
      console.error("[partner] save failed:", result.error);
      showToast("error", result.error?.message || "Save failed, please try again.", 4000);
      return;
    }
    // `fromPrice` is derived from packages by the read mapper, so recompute it
    // here rather than carrying the stale value the draft was seeded with —
    // otherwise editing the rate card leaves the "from $X" line showing the old
    // cheapest price until the next full page load.
    const prices = (draft.packages ?? [])
      .map((p) => Number(p.price))
      .filter((n) => Number.isFinite(n));
    const saved = {
      ...draft,
      slug: result.slug ?? draft.slug,
      fromPrice: prices.length ? Math.min(...prices) : null,
    };
    setPartner(saved);
    setEditingKey(null);
    showToast("ok", "Section saved", 1600);
    // A rename moves the page, so the URL has to follow it.
    if (result.slug && result.slug !== partner.slug) {
      router.replace(`/partners/${result.slug}`);
    }
  };

  // Visibility has no section editor, so it persists immediately from the
  // sidebar. Keep any open draft in sync so a later section save can't revert it.
  const onVisibilityChange = async (value) => {
    const next = { ...partner, visibility: value };
    const result = await savePartnerProfile(supabase, next, partner.name);
    if (!result.ok) {
      showToast("error", result.error?.message || "Couldn't update visibility.", 3500);
      return;
    }
    setPartner(next);
    setDraft((d) => ({ ...d, visibility: value }));
    showToast("ok", value === "public" ? "Your page is live." : "Your page is hidden.", 2000);
  };

  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // A section editor renders as a modal: lock background scroll and let Escape
  // close it, same as OwnerProfile.
  useEffect(() => {
    if (!editingKey) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setEditingKey(null); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [editingKey]);

  const regionProps = (k, label, maxW = 760) => ({
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
    <div className="bg-[color:var(--paper-card)] bleed-under-nav relative overflow-hidden pb-24">
      <DeskBackdrop />
      <div className="relative z-10 max-w-[1128px] mx-auto px-6 pt-6">
        <EditRegion
          {...regionProps("header", "centre details", 1100)}
          view={<PartnerHeaderCard partner={partner} />}
          edit={
            <div>
              <h2 className="text-[18px] font-light text-slate-800 tracking-tight">Centre details</h2>
              <p className="text-[13px] text-slate-500 mt-1 mb-5">
                The logo, banner and name at the top of your page.
              </p>
              <PartnerImagesSection partner={draft} set={set} supabase={supabase} userId={userId} />
              <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--desk)" }}>
                <PartnerIdentitySection partner={draft} set={set} />
              </div>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[10px] mt-[10px] items-start">
          <div className="space-y-[10px]">
            <EditRegion
              {...regionProps("tutors", "our tutors", 820)}
              closeOnly
              view={
                tutors.length > 0 ? (
                  <PartnerTutorsCard tutors={tutors} partnerName={partner.name} />
                ) : (
                  <PlaceholderCard
                    title="Our tutors"
                    body="Add your tutors and they'll show here, and in the main tutor search."
                  />
                )
              }
              edit={
                <div>
                  <h2 className="text-[18px] font-light text-slate-800 tracking-tight mb-1">Our tutors</h2>
                  <PartnerTutorsEditor
                    partnerId={partner.id}
                    ownerId={userId}
                    tutors={tutors}
                    setTutors={setTutors}
                    supabase={supabase}
                    subjectCatalog={subjectCatalog}
                    onToast={showToast}
                  />
                </div>
              }
            />

            <EditRegion
              {...regionProps("about", "about")}
              view={
                partner.bioLong ? (
                  <PartnerAboutCard partner={partner} />
                ) : (
                  <PlaceholderCard
                    title="About"
                    body="Tell students who you teach and how you teach them."
                  />
                )
              }
              edit={
                <div>
                  <h2 className="text-[18px] font-light text-slate-800 tracking-tight mb-5">About</h2>
                  <PartnerAboutSection partner={draft} set={set} />
                </div>
              }
            />
          </div>

          <aside className="space-y-[10px]">
            <VisibilityCard partner={partner} onChange={onVisibilityChange} />

            <EditRegion
              {...regionProps("rate", "rates")}
              view={<PartnerRateCard partner={partner} showEnquire={false} />}
              edit={
                <div>
                  <h2 className="text-[18px] font-light text-slate-800 tracking-tight mb-1">Rates</h2>
                  <PartnerRateSection partner={draft} set={set} />
                </div>
              }
            />

            <EditRegion
              {...regionProps("location", "location")}
              view={<PartnerLocationCard partner={partner} />}
              edit={
                <div>
                  <h2 className="text-[18px] font-light text-slate-800 tracking-tight mb-5">Where we are</h2>
                  <PartnerLocationSection partner={draft} set={set} />
                </div>
              }
            />
          </aside>
        </div>
      </div>

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 text-[13px] font-medium"
          style={{
            borderRadius: 999,
            background: toast.kind === "error" ? "#FEF2F2" : "var(--ink)",
            color: toast.kind === "error" ? "#DC2626" : "#fff",
            border: toast.kind === "error" ? "1px solid #FECACA" : "none",
            boxShadow: "0 20px 50px -20px rgba(0,30,30,0.4)",
          }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

/**
 * Live / hidden switch. Persists immediately rather than through a section
 * editor, because it is one boolean and a Save button would be ceremony.
 */
function VisibilityCard({ partner, onChange }) {
  const live = partner.visibility === "public";
  return (
    <SidebarCard title="Your page">
      <div className="flex items-center gap-2 mt-2.5 text-[13.5px]" style={{ color: live ? "var(--accent)" : "var(--ink-muted)" }}>
        <Icon name={live ? "check-circle" : "eye-off"} size={15} />
        <span>{live ? "Live and visible to students" : "Hidden from students"}</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(live ? "hidden" : "public")}
        className="mt-3 w-full text-[13px] font-medium transition-colors hover:bg-slate-100"
        style={{ border: "1px solid var(--paper-line)", borderRadius: 999, padding: "9px 14px", color: "var(--ink)" }}
      >
        {live ? "Hide my page" : "Make my page live"}
      </button>
      {live && (
        <a
          href={`/partners/${partner.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] mt-3"
          style={{ color: "var(--accent)" }}
        >
          See what students see <Icon name="external" size={12} />
        </a>
      )}
    </SidebarCard>
  );
}

function PlaceholderCard({ title, body }) {
  return (
    <section className="bg-[color:var(--paper-card)]" style={{ ...cardStyle, padding: "20px 24px" }}>
      <h2 className="text-[22px] font-light text-slate-800 tracking-tight mb-3">{title}</h2>
      <div className="text-[13.5px] text-slate-500 py-4 px-4 text-center" style={{ background: "var(--bg-soft)", borderRadius: 10 }}>
        {body}
      </div>
    </section>
  );
}

// Lifted from OwnerProfile.jsx. Kept as a local copy on purpose: it is pure
// presentation with no partner/tutor knowledge, and hoisting it into a shared
// module would mean any restyle of one editor silently restyles the other.
// `closeOnly` is a local addition: the tutors panel persists every action as it
// happens (adding a tutor mints an auth user, which cannot be drafted), so it
// gets a single Done button instead of a Cancel/Save pair that would imply
// changes are still pending.
function EditRegion({ editing, saving, dirty, onEdit, onCancel, onSave, label, view, edit, maxW = 640, closeOnly = false }) {
  return (
    <div className="relative">
      {view}
      {!editing && (
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
              {closeOnly ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3.5 py-1.5 text-[12.5px] font-medium rounded-full inline-flex items-center gap-1.5"
                  style={{ background: "var(--ink)", color: "#fff" }}
                >
                  <Icon name="check" size={13} strokeWidth={2.4} /> Done
                </button>
              ) : (
              <>
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
              </>
              )}
            </div>
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
