// ============================================================================
// Field-by-field diff of a tutor's live profile against a draft (pure).
// ----------------------------------------------------------------------------
// Both sides are editor-shaped (getTutorProfileForEditor / payloadToEditor),
// documents are the list shape from lib/profileRevision.js. One definition
// feeds every place that asks "what changed": the owner card ("Unsubmitted
// changes" vs nothing to submit), the submit route (refuses an empty diff), the
// admin email summary and the admin review page.
//
// Each entry: { key, label, kind, before, after, added?, removed?, renamed? }
//   kind "text"         before/after are display strings
//   kind "image"        before/after are raw photo values (URL or "staging:…")
//   kind "list"         before/after are arrays of display strings
//   kind "subjects"     added/removed are subject labels
//   kind "availability" before/after are raw availability grids
//   kind "documents"    added/removed are titles, renamed is [{ before, after }]
// ============================================================================

import { subjectLabel } from "@/lib/subjects";
import { yearRangeLabel } from "@/lib/yearLevels";

const norm = (v) => (typeof v === "string" ? v.trim() : v ?? null);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const TEXT_FIELDS = [
  { key: "name", label: "Name", get: (t) => t.name },
  { key: "bio", label: "Tagline", get: (t) => t.bio },
  { key: "bioLong", label: "About", get: (t) => t.bioLong },
  { key: "location", label: "Location", get: (t) => [t.suburb, t.city].filter(Boolean).join(", ") },
  {
    key: "serviceArea",
    label: "Service area",
    get: (t) => (t.serviceArea?.suburb ? `${t.serviceArea.suburb}, within ${t.serviceArea.radiusKm ?? 5} km` : ""),
  },
  {
    key: "delivery",
    label: "Lesson format",
    get: (t) => [t.deliversInPerson && "In person", t.deliversOnline && "Online"].filter(Boolean).join(" and ") || "None",
  },
  { key: "responsiveText", label: "Response time", get: (t) => t.responsiveText },
  { key: "years", label: "Year levels", get: (t) => yearRangeLabel(t.yearMin, t.yearMax) },
  { key: "yearsTutoring", label: "Years tutoring", get: (t) => String(t.yearsTutoring ?? 0) },
  { key: "rate", label: "Hourly rate", get: (t) => `$${t.rate ?? 0}/hr` },
  { key: "languages", label: "Languages", get: (t) => (t.languages ?? []).join(", ") },
  { key: "bannerBg", label: "Banner colour", get: (t) => t.bannerBg ?? "" },
];

const IMAGE_FIELDS = [
  { key: "avatarImg", label: "Profile photo" },
  { key: "bannerImg", label: "Banner image" },
];

const LIST_FIELDS = [
  { key: "credentials", label: "Credentials", get: (t) => (t.credentials ?? []).map((c) => c.label).filter(Boolean) },
  {
    key: "experience",
    label: "Experience",
    get: (t) =>
      (t.experience ?? [])
        .filter((e) => e.role || e.org || e.note)
        .map((e) => [e.role, e.org, e.period && `(${e.period})`, e.note && `: ${e.note}`].filter(Boolean).join(" ")),
  },
  {
    key: "education",
    label: "Education",
    get: (t) => (t.education ?? []).filter((e) => e.school || e.detail).map((e) => [e.school, e.detail].filter(Boolean).join(", ")),
  },
  {
    key: "packages",
    label: "Packages",
    get: (t) => (t.packages ?? []).filter((p) => p.label || p.price).map((p) => `${p.label || "Package"}: $${p.price ?? 0}`),
  },
];

/**
 * @param live, draft   editor-shaped profiles
 * @param liveDocs, draftDocs  documentation lists ([{ id, title, ... }])
 * @param subjectCatalog  getSubjects() rows, for subject labels
 */
export function diffProfiles({ live, draft, liveDocs = [], draftDocs = [], subjectCatalog = [] }) {
  if (!live || !draft) return [];
  const out = [];

  for (const f of TEXT_FIELDS) {
    const before = norm(f.get(live)) ?? "";
    const after = norm(f.get(draft)) ?? "";
    if (before !== after) out.push({ key: f.key, label: f.label, kind: "text", before, after });
  }

  for (const f of IMAGE_FIELDS) {
    const before = live[f.key] ?? null;
    const after = draft[f.key] ?? null;
    if (before !== after) out.push({ key: f.key, label: f.label, kind: "image", before, after });
  }

  for (const f of LIST_FIELDS) {
    const before = f.get(live).map(norm);
    const after = f.get(draft).map(norm);
    if (!same(before, after)) out.push({ key: f.key, label: f.label, kind: "list", before, after });
  }

  const beforeSubjects = live.subjects ?? [];
  const afterSubjects = draft.subjects ?? [];
  if (!same(beforeSubjects, afterSubjects)) {
    const bySlug = new Map(subjectCatalog.map((s) => [s.slug, s]));
    const label = (slug) => subjectLabel(bySlug.get(slug) ?? { name: slug });
    const added = afterSubjects.filter((s) => !beforeSubjects.includes(s)).map(label);
    const removed = beforeSubjects.filter((s) => !afterSubjects.includes(s)).map(label);
    out.push({ key: "subjects", label: "Subjects", kind: "subjects", added, removed, reordered: added.length === 0 && removed.length === 0 });
  }

  if (!same(live.availability, draft.availability)) {
    out.push({ key: "availability", label: "Availability", kind: "availability", before: live.availability, after: draft.availability });
  }

  const liveById = new Map(liveDocs.map((d) => [d.id, d]));
  const draftIds = new Set(draftDocs.filter((d) => d.id).map((d) => d.id));
  const added = draftDocs.filter((d) => !d.id || !liveById.has(d.id)).map((d) => d.title);
  const removed = liveDocs.filter((d) => !draftIds.has(d.id)).map((d) => d.title);
  const renamed = draftDocs
    .filter((d) => d.id && liveById.has(d.id) && norm(liveById.get(d.id).title) !== norm(d.title))
    .map((d) => ({ before: liveById.get(d.id).title, after: d.title }));
  if (added.length || removed.length || renamed.length) {
    out.push({ key: "documents", label: "Documents", kind: "documents", added, removed, renamed });
  }

  return out;
}

/** "Name, About and Subjects" style summary of what a diff touches. */
export function diffSummary(diff) {
  const labels = (diff ?? []).map((d) => d.label);
  if (labels.length === 0) return "No changes";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
