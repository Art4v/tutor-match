import { AVAILABILITY_HOURS, AVAILABILITY_DAYS } from "@/lib/availability";

/**
 * Bridge the editor-shaped tutor draft (from getTutorProfileForEditor /
 * defaultTutor) to the display shape the public profile components expect
 * (from tutorRowToDetail). They are identical except:
 *   - `responsiveText`  →  `responsive`
 *   - `subjects` is an array of slugs in the editor, but an array of
 *     `{ name, slug, exam }` objects on the public profile.
 *   - `availability` is a raw 2D grid in the editor, but a normalized
 *     `{ hours, days, grid }` object on the public profile (what
 *     AvailabilityGrid reads).
 *
 * Used by OwnerProfile so the existing read-only profile components can render
 * directly off the live editing draft — the page itself is the live preview.
 */
export function editorToDisplay(draft, subjectCatalog = []) {
  const bySlug = new Map((subjectCatalog ?? []).map((s) => [s.slug, s]));
  return {
    ...draft,
    responsive: draft.responsiveText ?? "",
    subjects: (draft.subjects ?? [])
      .map((slug) => bySlug.get(slug) ?? { name: slug, slug, exam: null })
      .filter(Boolean),
    availability: normalizeAvailability(draft.availability),
  };
}

// Mirror of lib/supabase/tutors.js normalizeAvailability: pair the editor's 2D
// grid with the canonical hour/day labels so AvailabilityGrid's rows line up.
function normalizeAvailability(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return {
      hours: AVAILABILITY_HOURS.slice(0, raw.length),
      days: AVAILABILITY_DAYS.slice(0, raw[0]?.length ?? 7),
      grid: raw,
    };
  }
  if (raw.grid && raw.hours && raw.days) return raw;
  return null;
}
