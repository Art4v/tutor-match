// ============================================================================
// Landing-page arithmetic for /tutors/<state> and /tutors/<state>/<subject>.
// ----------------------------------------------------------------------------
// Pure functions over the output of listIndexableTutors (lib/supabase/tutors.js).
// No I/O, so the sitemap, llms.txt and the landing pages can all call them on
// the one list they already fetched and are guaranteed to agree.
//
// Every sentence produced here is a fact computed from live data. Nothing is
// addressed to AI models and nothing claims more than the numbers show: these
// pages are quoted verbatim by search and AI agents, and an overclaim quoted
// back at a parent costs more trust than it earns.
// ============================================================================

import { AU_STATES } from "@/lib/states";

// A combination needs at least this many tutors to be indexed. Below it the page
// still renders but is noindex, since a one-tutor page reads as thin content to
// search engines and as a weak result to an agent that lands on it.
export const MIN_INDEXABLE = 3;

/**
 * Count tutors per state and per (state, subject), and flag which reach
 * MIN_INDEXABLE. Tutors with no recognised state are skipped (they have no
 * landing page to sit on).
 *
 * Returns:
 *   states:   [{ state, count, indexable }]                       in AU_STATES order
 *   subjects: [{ state, slug, name, exam, count, indexable }]     by state, then count desc
 */
export function indexableCombos(tutors) {
  const stateCounts = new Map();
  const subjectCounts = new Map(); // "NSW|hsc-chemistry" -> { ..., count }

  for (const t of tutors) {
    if (!t.state) continue;
    stateCounts.set(t.state, (stateCounts.get(t.state) ?? 0) + 1);
    for (const s of t.subjects) {
      const key = `${t.state}|${s.slug}`;
      const entry = subjectCounts.get(key) ?? {
        state: t.state,
        slug: s.slug,
        name: s.name,
        exam: s.exam,
        count: 0,
      };
      entry.count += 1;
      subjectCounts.set(key, entry);
    }
  }

  const states = AU_STATES.filter((s) => stateCounts.has(s.slug)).map((s) => {
    const count = stateCounts.get(s.slug);
    return { state: s.slug, count, indexable: count >= MIN_INDEXABLE };
  });

  const stateOrder = new Map(AU_STATES.map((s, i) => [s.slug, i]));
  const subjects = [...subjectCounts.values()]
    .map((e) => ({ ...e, indexable: e.count >= MIN_INDEXABLE }))
    .sort(
      (a, b) =>
        stateOrder.get(a.state) - stateOrder.get(b.state) ||
        b.count - a.count ||
        a.slug.localeCompare(b.slug)
    );

  return { states, subjects };
}

/**
 * The facts a landing page states about the tutors on it. Ranges are null when
 * no tutor contributes a value, so callers can drop the sentence rather than
 * print "from $null". Company tutors carry no rate (0069) and so never affect
 * the rate range; listIndexableTutors already nulls it for them.
 */
export function landingStats(tutors) {
  const atars = tutors.map((t) => t.atar).filter((n) => Number.isFinite(n));
  const rates = tutors.map((t) => t.rate).filter((n) => Number.isFinite(n) && n > 0);
  return {
    count: tutors.length,
    atarMin: atars.length ? Math.min(...atars) : null,
    atarMax: atars.length ? Math.max(...atars) : null,
    atarCount: atars.length,
    rateMin: rates.length ? Math.min(...rates) : null,
    rateMax: rates.length ? Math.max(...rates) : null,
    ratedCount: tutors.filter((t) => t.reviews > 0).length,
    companyCount: tutors.filter((t) => t.isCompanyTutor).length,
  };
}

export function formatAtar(n) {
  return Number(n).toFixed(2);
}

export function formatRate(n) {
  return `$${Math.round(n)}`;
}

/**
 * Templated FAQ for a landing page, built from landingStats. `subject` is a
 * display label ("HSC Chemistry") or null on a state-only page; `place` is the
 * full state name. Questions whose answer would be empty are left out.
 *
 * Returns [{ question, answer }], the shape both the visible FAQ and the
 * FAQPage JSON-LD read.
 */
export function landingFaq({ place, subject, stats }) {
  const what = subject ? `${subject} tutors` : "private tutors";
  const faq = [];

  faq.push({
    question: `How many ${what} are on MatchTutor in ${place}?`,
    answer:
      `${stats.count} ${stats.count === 1 ? "tutor is" : "tutors are"} listed in ${place}. ` +
      "Every tutor listed has either been verified by MatchTutor or belongs to a tutoring company listed on MatchTutor.",
  });

  if (stats.atarMin != null) {
    faq.push({
      question: `What ATARs do these tutors have?`,
      answer:
        stats.atarMin === stats.atarMax
          ? `The tutor who lists an ATAR here scored ${formatAtar(stats.atarMin)}.`
          : `${stats.atarCount} of these tutors list an ATAR, ranging from ${formatAtar(stats.atarMin)} to ${formatAtar(stats.atarMax)}.`,
    });
  }

  if (stats.rateMin != null) {
    const range =
      stats.rateMin === stats.rateMax
        ? `Listed hourly rates are ${formatRate(stats.rateMin)}.`
        : `Listed hourly rates range from ${formatRate(stats.rateMin)} to ${formatRate(stats.rateMax)}.`;
    faq.push({
      question: `How much does a private ${subject ? `${subject} ` : ""}tutor cost in ${place}?`,
      answer: stats.companyCount
        ? `${range} Tutoring companies price by package instead, shown on each company's page.`
        : range,
    });
  }

  if (stats.ratedCount > 0) {
    faq.push({
      question: "Do these tutors have reviews?",
      answer:
        `${stats.ratedCount} of these tutors ${stats.ratedCount === 1 ? "has" : "have"} reviews from students. ` +
        "MatchTutor moderates every review before it is published.",
    });
  }

  faq.push({
    question: "How do I contact a tutor?",
    answer:
      "Open a tutor's profile and message them from a student account. " +
      "Tutors who belong to a tutoring company are contacted through that company.",
  });

  return faq;
}
