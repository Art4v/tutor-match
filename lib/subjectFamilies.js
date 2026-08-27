// Cross-exam subject families for the GENERAL umbrella subjects.
//
// The catalog is exam-scoped (0009_subject_catalog.sql): the same real-world
// subject recurs once per certificate under an exam-prefixed slug, so
// 'hsc-biology' and 'vce-biology' are unrelated rows. The GENERAL exam group
// (0011, extended by 0031) holds eight bare foundation subjects, and it is the
// tab both subject pickers open on — so "English" is what a student clicks
// first, and an exact-slug match would show them only the handful of tutors who
// listed that literal General row.
//
// This map makes those eight read as umbrellas: picking one filters across the
// whole family in every exam. Expansion is ONE WAY. An exam-specific slug is
// never widened (picking HSC Chemistry stays HSC Chemistry), and a tutor who
// lists only General English does not surface under HSC English Advanced — a
// K-10 English tutor is not an HSC English tutor.
//
// MAINTENANCE: this is data about the seed catalog, not a rule. A migration
// that seeds a new subject belonging to one of these families must add its slug
// here, or the umbrella will quietly miss it (unknown slugs are dropped by the
// `.in()` in getTutorsForBrowse rather than erroring).
// `supabase/utilities/check_subject_families.sql` catches typos and drift.
export const SUBJECT_FAMILIES = Object.freeze({
  // Every English / Literature / EAL course. VCE "Languages Other Than
  // English" is deliberately absent: it is a language elective, the same
  // carve-out subjectCategory() makes in lib/subjects.js.
  "general-english": [
    "act-english-t",
    "act-english-as-an-additional-language-eal-d",
    "act-essential-english-a",
    "hsc-english-advanced",
    "hsc-english-standard",
    "hsc-english-studies",
    "hsc-english-extension-1",
    "hsc-english-extension-2",
    "ib-english-a-language-and-literature",
    "ib-english-a-literature",
    "qce-english",
    "qce-essential-english",
    "sace-english",
    "sace-english-as-an-additional-language-eal",
    "sace-essential-english",
    "tce-english",
    "tce-english-literature",
    "tce-english-writing",
    "vce-english",
    "vce-english-as-an-additional-language-eal",
    "vce-english-language",
    "vce-literature",
    "wace-english-atar",
    "wace-english-general",
    "wace-literature",
  ],

  // Every Mathematics / Mathematical course, Essential through Specialist.
  "general-mathematics": [
    "act-mathematical-applications-t",
    "act-mathematical-methods-t",
    "act-specialist-mathematics-t",
    "hsc-mathematics-standard-1",
    "hsc-mathematics-standard-2",
    "hsc-mathematics-advanced",
    "hsc-mathematics-extension-1",
    "hsc-mathematics-extension-2",
    "ib-mathematics-analysis-and-approaches",
    "ib-mathematics-applications-and-interpretation",
    "qce-essential-mathematics",
    "qce-general-mathematics",
    "qce-mathematical-methods",
    "qce-specialist-mathematics",
    "sace-essential-mathematics",
    "sace-general-mathematics",
    "sace-mathematical-methods",
    "sace-specialist-mathematics",
    "tce-general-mathematics",
    "tce-mathematics-methods",
    "tce-mathematics-specialist",
    "vce-further-mathematics-general-mathematics",
    "vce-mathematical-methods",
    "vce-specialist-mathematics",
    "wace-mathematics-applications",
    "wace-mathematics-methods",
    "wace-mathematics-specialist",
  ],

  // The natural sciences. Computer Science, Food Science, Sport/Exercise
  // Science and Physical Education are deliberately excluded: they carry
  // "science" in the name but are not what someone picking "Science" wants.
  "general-science": [
    "act-biology-t",
    "act-chemistry-t",
    "act-physics-t",
    "act-psychology-t",
    "hsc-biology",
    "hsc-chemistry",
    "hsc-physics",
    "hsc-investigating-science",
    "ib-biology",
    "ib-chemistry",
    "ib-physics",
    "ib-psychology",
    "ib-environmental-systems-and-societies",
    "qce-agricultural-science",
    "qce-biology",
    "qce-chemistry",
    "qce-physics",
    "qce-psychology",
    "sace-biology",
    "sace-chemistry",
    "sace-physics",
    "sace-psychology",
    "tce-agricultural-systems",
    "tce-biology",
    "tce-chemistry",
    "tce-physical-sciences",
    "tce-physics",
    "tce-psychology",
    "vce-biology",
    "vce-chemistry",
    "vce-physics",
    "vce-psychology",
    "wace-biology",
    "wace-human-biology",
    "wace-chemistry",
    "wace-earth-and-environmental-science",
    "wace-physics",
    "wace-psychology",
  ],

  // Ancient + Modern History across the exams. SACE's ancient-history course
  // is named "Ancient Studies", so it is matched by intent, not by name.
  "general-history": [
    "act-ancient-history-t",
    "act-modern-history-t",
    "hsc-ancient-history",
    "hsc-modern-history",
    "ib-history",
    "qce-ancient-history",
    "qce-modern-history",
    "sace-ancient-studies",
    "sace-modern-history",
    "tce-ancient-history",
    "tce-modern-history",
    "vce-history",
    "wace-ancient-history",
    "wace-modern-history",
  ],

  "general-geography": [
    "act-geography-t",
    "hsc-geography",
    "ib-geography",
    "qce-geography",
    "sace-geography",
    "tce-geography",
    "vce-geography",
    "wace-geography",
  ],

  // Visual arts and the design courses that sit in the same faculty. Design
  // and Technology / Product Design are excluded as technology subjects.
  "general-art": [
    "act-visual-arts-t",
    "hsc-visual-arts",
    "ib-visual-arts",
    "qce-visual-art",
    "qce-design",
    "sace-creative-arts",
    "sace-visual-arts-art",
    "sace-visual-arts-design",
    "tce-art-production",
    "tce-visual-art",
    "vce-studio-arts-art-making-and-exhibiting",
    "vce-visual-communication-design",
    "wace-visual-arts",
    "wace-design",
  ],

  "general-music": [
    "act-music-t",
    "hsc-music-1",
    "ib-music",
    "qce-music",
    "sace-music",
    "tce-music",
    "vce-music",
    "wace-music",
  ],

  // Language courses. Seeded unevenly: HSC lists three languages (0030), IB
  // lists one row per language, VCE has a single catch-all, and SACE/TCE/WACE
  // have none yet.
  "general-languages": [
    "act-languages-t",
    "hsc-french",
    "hsc-italian",
    "hsc-japanese",
    "ib-french-ab-initio-b",
    "ib-german-b",
    "ib-japanese-b",
    "ib-mandarin-chinese-ab-initio-b",
    "ib-spanish-ab-initio-b",
    "qce-japanese",
    "vce-languages-other-than-english",
  ],
});

/**
 * Widen a list of subject slugs for querying: a GENERAL umbrella slug brings
 * its whole cross-exam family along, every other slug passes through untouched.
 * The umbrella slug itself is kept, so tutors who listed the General row still
 * match. Deduped, so callers can pass overlapping selections safely.
 *
 * Query-side only. Never write the expanded list back to the URL or to a
 * tutor's stored subjects: the filter chip stays "English" and the URL stays
 * `?subject=general-english`.
 */
export function expandSubjectSlugs(slugs = []) {
  const out = new Set();
  for (const slug of slugs) {
    out.add(slug);
    for (const sibling of SUBJECT_FAMILIES[slug] ?? []) out.add(sibling);
  }
  return Array.from(out);
}
