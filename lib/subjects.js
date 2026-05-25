// Shared subject helpers. Subjects are exam-scoped (see migrations
// 0009_subject_catalog.sql + 0010_rename_certificates_to_exams.sql): the same
// display name (Biology, English, ...) recurs across exams, so the canonical
// identity is the `slug` (exam-prefixed, e.g. 'vce-biology') and the human label
// folds the exam code in front of the name.

export const TEST_EXAM_CODE = "TEST";

/**
 * Human label for a subject. Exam subjects read "VCE Biology"; the
 * admissions/aptitude tests (TEST group) have no curriculum prefix, so they
 * read as just "UCAT".
 *
 * Accepts a subject object `{ name, exam }` where `exam` is the exam code
 * (e.g. 'VCE'), or falls back to the bare name.
 */
export function subjectLabel(subject) {
  if (!subject) return "";
  const name = subject.name ?? "";
  const exam = subject.exam;
  return exam && exam !== TEST_EXAM_CODE ? `${exam} ${name}` : name;
}

/**
 * Group a flat catalog (from getSubjects) into exam sections, preserving the
 * catalog's existing order (it arrives sorted by exam then subject position).
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
  return groups;
}
