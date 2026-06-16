// Shared subject helpers. Subjects are exam-scoped (see migrations
// 0009_subject_catalog.sql + 0010_rename_certificates_to_exams.sql): the same
// display name (Biology, English, ...) recurs across exams, so the canonical
// identity is the `slug` (exam-prefixed, e.g. 'vce-biology') and the human label
// folds the exam code in front of the name.

export const TEST_EXAM_CODE = "TEST";
export const GENERAL_EXAM_CODE = "GENERAL";

// Exam groups whose subjects read bare (no curriculum prefix): the admissions/
// aptitude tests ("UCAT") and the foundation General subjects ("English").
const NO_PREFIX_EXAMS = new Set([TEST_EXAM_CODE, GENERAL_EXAM_CODE]);

/**
 * Human label for a subject. Exam subjects read "VCE Biology"; the
 * admissions/aptitude tests (TEST group) and the foundation General subjects
 * have no curriculum prefix, so they read as just "UCAT" / "English".
 *
 * Accepts a subject object `{ name, exam }` where `exam` is the exam code
 * (e.g. 'VCE'), or falls back to the bare name.
 */
export function subjectLabel(subject) {
  if (!subject) return "";
  const name = subject.name ?? "";
  const exam = subject.exam;
  return exam && !NO_PREFIX_EXAMS.has(exam) ? `${exam} ${name}` : name;
}

// Subject dropdowns list subjects in a faculty-first order — English, then
// Maths, then the Sciences, then the HSIE/humanities, then everything else —
// and alphabetically within each faculty. `subjectCategory` buckets a subject
// by its display name; the checks are ordered so the first match wins.
function subjectCategory(name = "") {
  const n = name.toLowerCase();
  // "Languages Other Than English" is a language elective, not English.
  if (n.includes("languages other than english")) return 4;
  if (/english|literature|\beal\b/.test(n)) return 0; // English
  if (n.includes("math")) return 1; // Maths
  if (/\bphysics\b|biolog|chemis|psycholog|science|environmental/.test(n)) return 2; // Sciences
  if (/history|geograph|economic|business|commerce|legal|societ|religion|politic|sociolog|philosoph|account|enterprise|civics|aboriginal/.test(n)) return 3; // HSIE
  return 4; // Other
}

/**
 * Order subjects faculty-first (English → Maths → Sciences → HSIE → Other),
 * then lexicographically by display name within each faculty.
 */
export function sortSubjectsByCategory(subjects = []) {
  return [...subjects].sort(
    (a, b) =>
      subjectCategory(a.name) - subjectCategory(b.name) ||
      (a.name ?? "").localeCompare(b.name ?? "")
  );
}

/**
 * Group a flat catalog (from getSubjects) into exam sections, preserving the
 * catalog's exam order (it arrives sorted by exam then subject position) but
 * sorting the subjects within each exam faculty-first (see sortSubjectsByCategory).
 * Returns `[{ code, name, subjects: [...] }]`.
 */
export function groupByExam(catalog = []) {
  const groups = [];
  const byCode = new Map();
  for (const s of catalog) {
    let g = byCode.get(s.exam);
    if (!g) {
      g = { code: s.exam, name: s.examName ?? s.exam, subjects: [] };
      byCode.set(s.exam, g);
      groups.push(g);
    }
    g.subjects.push(s);
  }
  for (const g of groups) g.subjects = sortSubjectsByCategory(g.subjects);
  return groups;
}
