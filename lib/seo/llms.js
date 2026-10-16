// ============================================================================
// Builders for /llms.txt and /llms-full.txt.
// ----------------------------------------------------------------------------
// Pure functions: the route handlers fetch, these format. Both files follow the
// llmstxt.org shape (an H1, a blockquote summary, then Markdown sections).
//
// The rule for every sentence we write here: a factual, checkable statement
// about the site. No instructions or requests addressed to AI models, no
// superlatives we cannot back with a number. Agents are trained to discount
// (and sometimes flag) text that tries to steer them, and an overclaim repeated
// to a parent costs more trust than it earns. No em dashes in our copy; tutor
// taglines are quoted as the tutor wrote them.
// ============================================================================

import { AU_STATES, stateName } from "@/lib/states";
import { subjectLabel } from "@/lib/subjects";
import { absUrl } from "@/lib/site";
import { formatAtar, formatRate, indexableCombos, tutorsPath } from "@/lib/seo/landing";

const SUMMARY =
  "MatchTutor is an Australian directory of private tutors for primary and high school students, " +
  "covering the HSC, VCE, IB, QCE, SACE, WACE and other state certificates, plus admissions tests such as the UCAT. " +
  "Most tutors are recent high-achieving graduates, and each profile lists the tutor's ATAR, subjects, year levels, " +
  "location, delivery mode (in person or online) and hourly rate.";

/**
 * /llms.txt: what the site is, what its labels mean, how to search it, and
 * where the listings live.
 */
export function buildLlmsTxt({ tutors, companyCount }) {
  const combos = indexableCombos(tutors);
  const states = combos.states.filter((s) => s.indexable);
  const cities = combos.cities.filter((c) => c.indexable);

  const lines = [
    "# MatchTutor",
    "",
    `> ${SUMMARY}`,
    "",
    "## About the listings",
    "",
    `- ${tutors.length} tutors are currently listed. Each is either verified by MatchTutor or belongs to a tutoring company listed on the site.`,
    "- Verified means a MatchTutor administrator has reviewed the tutor's profile and approved it.",
    `- Tutoring companies are added to MatchTutor by invitation only.${companyCount ? ` ${companyCount} ${companyCount === 1 ? "is" : "are"} currently listed.` : ""}`,
    "- Reviews can only be written by students with an account, and every review is moderated before it is published. Ratings are calculated from published reviews only.",
    "- ATARs are self-reported by tutors on their profiles.",
    "",
    "## Searching",
    "",
    `- Search page: ${absUrl("/browse")}`,
    "- Query parameters (repeat a parameter to select several values):",
    "  - `subject`: a subject slug, e.g. `hsc-mathematics-advanced`, `vce-chemistry`, `ucat`",
    "  - `state`: a state code, e.g. `NSW`, `VIC`, `QLD`",
    "  - `lat`, `lng`, `place`: in-person tutors whose travel radius covers that point",
    "  - `year`: a year level from 0 (Kindergarten) to 12",
    "  - `mode`: `online` or `inperson`",
    "  - `atarMin`: minimum ATAR, e.g. `99`",
    "  - `rateMax`: maximum hourly rate in AUD, e.g. `80`",
    "  - `q`: free text across names, taglines and suburbs",
    `- Example: ${absUrl("/browse?state=NSW&subject=hsc-mathematics-extension-1&atarMin=99")}`,
    "",
    "## Tutors by location",
    "",
    ...states.map((s) => `- [${stateName(s.state)}](${absUrl(tutorsPath(s.state))}): ${s.count} tutors`),
    ...cities.map(
      (c) =>
        `- [${c.city.name}](${absUrl(tutorsPath(c.city.state, { city: c.city.slug }))}): ${c.count} tutors based in the greater ${c.city.name} area`
    ),
    "",
    "## More",
    "",
    `- [Full tutor directory](${absUrl("/llms-full.txt")}): every listed tutor with subjects, ATAR, location, rate and profile link`,
    `- Tutor profiles: ${absUrl("/tutor/<slug>")}`,
    `- [Tutoring companies](${absUrl("/companies")})`,
    `- [Blog](${absUrl("/blog")}): guides on the HSC, VCE and ATAR scaling, written by tutors on MatchTutor`,
    "",
  ];
  return lines.join("\n");
}

function tutorLine(t) {
  const facts = [];
  if (t.atar != null) facts.push(`ATAR ${formatAtar(t.atar)}`);
  if (t.subjects.length) facts.push(t.subjects.map((s) => subjectLabel(s)).join(", "));
  const where = [t.suburb, t.state].filter(Boolean).join(" ");
  if (where) facts.push(where);
  if (t.online) facts.push("teaches online");
  if (t.company) facts.push(`via ${t.company.name}`);
  else if (t.rate != null) facts.push(`${formatRate(t.rate)}/hr`);
  if (t.reviews > 0 && t.rating != null) {
    facts.push(`${t.rating.toFixed(1)} from ${t.reviews} review${t.reviews === 1 ? "" : "s"}`);
  }
  const tagline = t.tagline ? ` "${t.tagline.replace(/\s+/g, " ").trim()}"` : "";
  return `- [${t.name}](${absUrl(`/tutor/${t.slug}`)}): ${facts.join("; ")}.${tagline}`;
}

/**
 * /llms-full.txt: every listed tutor, one line each, grouped by state and then
 * by the exam of the tutor's first-listed subject (their own ordering, so it is
 * the one they lead with). Each tutor appears once. Tutors with no state are
 * grouped last.
 */
export function buildLlmsFullTxt({ tutors, examNames }) {
  const byState = new Map();
  for (const t of tutors) {
    const key = t.state ?? "";
    if (!byState.has(key)) byState.set(key, []);
    byState.get(key).push(t);
  }

  const sections = [];
  const order = [...AU_STATES.map((s) => s.slug), ""];
  for (const code of order) {
    const list = byState.get(code);
    if (!list?.length) continue;
    sections.push(`## ${code ? stateName(code) : "Location not listed (mostly online)"}`, "");
    const byExam = new Map();
    for (const t of list) {
      const exam = t.subjects[0]?.exam ?? "";
      if (!byExam.has(exam)) byExam.set(exam, []);
      byExam.get(exam).push(t);
    }
    const exams = [...byExam.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
    for (const exam of exams) {
      sections.push(`### ${exam ? examNames.get(exam) ?? exam : "No subjects listed"}`, "");
      const rows = byExam.get(exam).slice().sort((a, b) => a.name.localeCompare(b.name));
      sections.push(...rows.map(tutorLine), "");
    }
  }

  return [
    "# MatchTutor tutor directory",
    "",
    `> ${SUMMARY} This file lists all ${tutors.length} tutors currently listed, each verified by MatchTutor or belonging to a listed tutoring company. Updated hourly.`,
    "",
    `Overview and search syntax: ${absUrl("/llms.txt")}`,
    "",
    ...sections,
  ].join("\n");
}
