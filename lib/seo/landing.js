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
import { CITIES, haversineKm } from "@/lib/cities";

// A combination needs at least this many tutors to be indexed. Below it the page
// still renders but is noindex, since a one-tutor page reads as thin content to
// search engines and as a weak result to an agent that lands on it.
export const MIN_INDEXABLE = 3;

/**
 * Who a city page lists. `local` = has a saved location within the city's
 * radius (circles may overlap, so a tutor can be local to two cities). `online`
 * = teaches online and is NOT local, whether located elsewhere or nowhere; they
 * are listed on every city page, after the local tutors, but never count
 * towards MIN_INDEXABLE, or every city would pass on the same online list.
 */
export function cityMembers(tutors, city) {
  const local = [];
  const online = [];
  for (const t of tutors) {
    const isLocal =
      t.lat != null &&
      t.lng != null &&
      haversineKm(city.lat, city.lng, t.lat, t.lng) <= city.radiusKm;
    if (isLocal) local.push(t);
    else if (t.online) online.push(t);
  }
  return { local, online };
}

export function teachesSubject(tutor, slug) {
  return tutor.subjects.some((s) => s.slug === slug);
}

/**
 * Count tutors per state, per (state, subject), per city and per (city,
 * subject), and flag which reach MIN_INDEXABLE. Tutors with no recognised
 * state are skipped from the state counts (they have no state page to sit on).
 * City counts are LOCAL tutors only; `onlineCount` is reported alongside.
 *
 * Returns:
 *   states:       [{ state, count, indexable }]                    in AU_STATES order
 *   subjects:     [{ state, slug, name, exam, count, indexable }]  by state, then count desc
 *   cities:       [{ city, count, onlineCount, indexable }]        in CITIES order
 *   citySubjects: [{ city, slug, name, exam, count, onlineCount, indexable }]
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

  const cities = [];
  const citySubjects = [];
  for (const city of CITIES) {
    const { local, online } = cityMembers(tutors, city);
    cities.push({
      city,
      count: local.length,
      onlineCount: online.length,
      indexable: local.length >= MIN_INDEXABLE,
    });
    const bySubject = new Map();
    const tally = (list, field) => {
      for (const t of list) {
        for (const s of t.subjects) {
          const entry = bySubject.get(s.slug) ?? {
            city,
            slug: s.slug,
            name: s.name,
            exam: s.exam,
            count: 0,
            onlineCount: 0,
          };
          entry[field] += 1;
          bySubject.set(s.slug, entry);
        }
      }
    };
    tally(local, "count");
    tally(online, "onlineCount");
    for (const e of bySubject.values()) {
      citySubjects.push({ ...e, indexable: e.count >= MIN_INDEXABLE });
    }
  }
  citySubjects.sort(
    (a, b) =>
      CITIES.indexOf(a.city) - CITIES.indexOf(b.city) ||
      b.count - a.count ||
      a.slug.localeCompare(b.slug)
  );

  return { states, subjects, cities, citySubjects };
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
 * display label ("HSC Chemistry") or null on a place-only page; `place` is the
 * full state name or the city name. On a city page `stats` covers the LOCAL
 * tutors and `onlineCount` the extra online-only list. Questions whose answer
 * would be empty are left out.
 *
 * Returns [{ question, answer }], the shape both the visible FAQ and the
 * FAQPage JSON-LD read.
 */
export function landingFaq({ place, subject, stats, onlineCount = 0 }) {
  const what = subject ? `${subject} tutors` : "private tutors";
  const faq = [];

  const based = `${stats.count} ${stats.count === 1 ? "tutor is" : "tutors are"} based in ${place}`;
  const online = onlineCount
    ? `, and ${onlineCount} more ${onlineCount === 1 ? "teaches" : "teach"} online`
    : "";
  faq.push({
    question: `How many ${what} are on MatchTutor in ${place}?`,
    answer:
      `${based}${online}. ` +
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

/**
 * Landing-page paths. Lowercase state code; the segment after it is a city slug
 * or a subject slug (lib/cities.js guards that the two can never collide), and
 * a subject under a city is the third segment.
 *   tutorsPath("NSW")                         -> /tutors/nsw
 *   tutorsPath("NSW", { subject })            -> /tutors/nsw/hsc-chemistry
 *   tutorsPath("NSW", { city })               -> /tutors/nsw/sydney
 *   tutorsPath("NSW", { city, subject })      -> /tutors/nsw/sydney/hsc-chemistry
 */
export function tutorsPath(state, { city = null, subject = null } = {}) {
  const parts = ["/tutors", state.toLowerCase()];
  if (city) parts.push(city);
  if (subject) parts.push(subject);
  return parts.join("/");
}

/**
 * The fact paragraph at the top of a landing page, and its meta description.
 * Every clause is a number from `stats`; clauses with no data are dropped.
 */
export function landingSummary({ place, subject, stats, onlineCount = 0 }) {
  const one = stats.count === 1;
  const noun = `${subject ? `${subject} tutor` : "private tutor"}${one ? "" : "s"}`;
  const online = onlineCount
    ? `, and ${onlineCount} more ${onlineCount === 1 ? "teaches" : "teach"} online`
    : "";
  let text = `${stats.count} ${noun} ${one ? "is" : "are"} based in ${place} on MatchTutor${online}.`;
  if (stats.atarMin != null) {
    text +=
      stats.atarMin === stats.atarMax
        ? ` Listed ATAR: ${formatAtar(stats.atarMin)}.`
        : ` Listed ATARs range from ${formatAtar(stats.atarMin)} to ${formatAtar(stats.atarMax)}.`;
  }
  if (stats.rateMin != null) {
    text +=
      stats.rateMin === stats.rateMax
        ? ` Hourly rate: ${formatRate(stats.rateMin)}.`
        : ` Hourly rates range from ${formatRate(stats.rateMin)} to ${formatRate(stats.rateMax)}.`;
  }
  text += " Every tutor listed is verified by MatchTutor or belongs to a listed tutoring company.";
  return text;
}
