// ============================================================================
// Profile revision payloads (pure, client + server).
// ----------------------------------------------------------------------------
// A verified tutor's draft (tutor_profile_revisions.payload, migration 0072) is
// stored in exactly the shape save_tutor_profile takes, built by
// buildSaveProfilePayload (lib/supabase/tutors.js), plus `full_name` and
// `documents`. The editor works in a camelCase "editor shape"
// (getTutorProfileForEditor). These helpers translate the stored draft back
// into that shape so the same section components and display components work
// on a draft as on the live profile.
//
// Photos in a draft are either the live URL, null, or "staging:<path>" for a
// file in the private profile-staging bucket; `resolveImage` turns the latter
// into a signed preview URL.
// ============================================================================

export const STAGING_PREFIX = "staging:";

export const isStaged = (value) => typeof value === "string" && value.startsWith(STAGING_PREFIX);
export const stagedPath = (value) => (isStaged(value) ? value.slice(STAGING_PREFIX.length) : null);

/**
 * Stored draft payload -> editor shape. Fields the draft does not carry
 * (identity, verification, rating, visibility…) come from `live`, the live
 * editor-shaped profile, so the result can be passed anywhere the live one can.
 */
export function payloadToEditor(payload, live) {
  if (!payload) return live;
  const p = payload.profile ?? {};
  return {
    ...live,
    name: payload.full_name ?? live.name,
    suburb: p.suburb ?? "",
    city: p.city ?? "",
    initial: p.initials ?? live.initial,
    avatarBg: p.avatar_bg ?? live.avatarBg,
    bannerBg: p.banner_bg ?? null,
    avatarImg: p.avatar_url ?? null,
    bannerImg: p.banner_url ?? null,
    deliversInPerson: p.delivers_in_person ?? true,
    deliversOnline: p.delivers_online ?? true,
    responsiveText: p.responsive ?? live.responsiveText,
    languages: p.languages ?? [],
    yearsTutoring: p.years_tutoring ?? 0,
    yearMin: p.year_min ?? 0,
    yearMax: p.year_max ?? 12,
    credentials: (p.credentials ?? []).filter((c) => c?.label),
    bio: p.bio ?? "",
    bioLong: p.bio_long ?? "",
    rate: p.rate ?? 0,
    serviceArea: p.service_area ?? live.serviceArea,
    availability: p.availability ?? live.availability,
    packages: (payload.packages ?? []).map((x) => ({ label: x.label ?? "", price: x.price ?? 0 })),
    experience: (payload.experience ?? []).map((x) => ({
      role: x.role ?? "",
      org: x.org ?? "",
      period: x.period ?? "",
      note: x.note ?? "",
    })),
    education: (payload.education ?? []).map((x) => ({
      school: x.school ?? "",
      schoolSlug: x.school_slug ?? null,
      detail: x.detail ?? "",
      level: x.level ?? "high_school",
    })),
    subjects: (payload.subjects ?? []).filter(Boolean),
  };
}

/**
 * Stored draft documents -> the list the documentation components render:
 * [{ id, title, path, stagedPath, url }]. Live documents take their public URL
 * from `liveDocs`; staged ones take a signed URL from `signed` ({ path: url }).
 * A draft with no `documents` key means "unchanged", so the live list is used.
 */
export function payloadDocsToList(payload, liveDocs = [], signed = {}) {
  if (!payload || !Array.isArray(payload.documents)) return liveDocs;
  const byId = new Map(liveDocs.map((d) => [d.id, d]));
  return payload.documents.map((d) => {
    if (d.id) {
      const live = byId.get(d.id);
      return { id: d.id, title: d.title, path: d.path ?? live?.path ?? "", stagedPath: null, url: live?.url ?? null };
    }
    return { id: null, title: d.title, path: "", stagedPath: d.staged_path, url: signed[d.staged_path] ?? null };
  });
}

/** Documentation list -> the payload's `documents`. */
export function docsListToPayload(docs = []) {
  return docs.map((d) => ({
    id: d.id ?? null,
    title: (d.title ?? "").trim(),
    path: d.id ? d.path ?? null : null,
    staged_path: d.id ? null : d.stagedPath ?? null,
  }));
}

/** Every staging path a payload references (photos + new documents). */
export function collectStagedPaths(payload) {
  if (!payload) return [];
  const out = new Set();
  for (const v of [payload.profile?.avatar_url, payload.profile?.banner_url]) {
    const p = stagedPath(v);
    if (p) out.add(p);
  }
  for (const d of payload.documents ?? []) {
    if (d?.staged_path) out.add(d.staged_path);
  }
  return [...out];
}

/** Display URL for a photo value: staged -> its signed URL, otherwise as is. */
export function resolveImage(value, signed = {}) {
  if (!value) return null;
  const p = stagedPath(value);
  return p ? signed[p] ?? null : value;
}
