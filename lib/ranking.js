/**
 * lib/ranking.js — the single home of the tutor ORDERING algorithm.
 *
 * Everything that decides "which tutor shows higher" lives here: what counts
 * toward a complete profile, how much each item is worth, how equal-scoring
 * tutors are tie-broken, and the final sort. Both the landing page (`/`) and
 * `/browse` order their cards by calling `rankTutors()` and nothing else.
 *
 * To TWEAK the algorithm, edit `RANKING_CONFIG` below — no page or data-layer
 * changes are needed:
 *   - make a field matter more/less → change its `weight`
 *   - add/remove a completeness signal → add/remove a { key, weight, test } entry
 *       (also fetch any new field it needs in BROWSE_SELECT + card.completion,
 *        in lib/supabase/tutors.js)
 *   - change how ties are ordered → swap `tieBreaker` (+ add a strategy in TIE_BREAKERS)
 *
 * The `test` functions read an editor-shaped object (the `card.completion` the
 * data layer attaches, and the in-memory tutor state in the /settings editor).
 * Keep this file free of "use client" / React so server code can import it.
 */

/**
 * Normalize an availability value to a 2D grid and report whether any cell is
 * marked available. Handles both shapes the app produces: the settings editor's
 * bare 2D array, and the persisted `{ hours, days, grid }` object.
 */
function gridHasAny(availability) {
  if (!availability) return false;
  const grid = Array.isArray(availability) ? availability : availability.grid;
  return (
    Array.isArray(grid) &&
    grid.some((row) => Array.isArray(row) && row.some((c) => c === 1))
  );
}

/** Count words the same way the /settings editor's bio counter does. */
function wordCount(text) {
  const t = (text || "").trim();
  return t ? t.split(/\s+/).length : 0;
}

// ── Tweak the ordering algorithm here ────────────────────────────────────────
export const RANKING_CONFIG = {
  // Each criterion is one signal that a profile is filled out. `weight` is its
  // contribution to the ranking score. All 1 today, so a tutor's ranking score
  // equals the number of completed items the /settings meter shows; raise a
  // weight to make that field count for more in the ordering.
  criteria: [
    // Cosmetic images carry no weight — present is nice, but they say nothing
    // about tutoring quality, so they don't affect ordering.
    { key: "Avatar uploaded",      weight: 0,   test: (t) => !!t.avatarImg },
    { key: "Banner uploaded",      weight: 0,   test: (t) => !!t.bannerImg },
    { key: "Name & tagline",       weight: 1,   test: (t) => !!t.name && !!t.bio },
    { key: "Location",             weight: 1,   test: (t) => !!t.suburb && !!t.city },
    { key: "Languages",            weight: 1,   test: (t) => (t.languages || []).length > 0 },
    { key: "Credentials",          weight: 1,   test: (t) => (t.credentials || []).filter((c) => c.label).length >= 2 },
    // A written bio is a strong signal of effort — weigh it heavily (4 normal
    // fields), so tutors who wrote one rank above those who didn't.
    { key: "Long bio (50+ words)", weight: 4,   test: (t) => wordCount(t.bioLong) >= 50 },
    { key: "Subjects (3+)",        weight: 1,   test: (t) => (t.subjects || []).length >= 3 },
    { key: "Year levels",          weight: 1,   test: (t) => Number.isFinite(t.yearMin) && Number.isFinite(t.yearMax) },
    { key: "Rate set",             weight: 1,   test: (t) => !!t.rate && t.rate > 0 },
    { key: "1+ package",           weight: 1,   test: (t) => (t.packages || []).filter((p) => p.price).length >= 1 },
    { key: "Experience",           weight: 1,   test: (t) => (t.experience || []).filter((e) => e.role).length >= 1 },
    { key: "Education",            weight: 1,   test: (t) => (t.education || []).filter((e) => e.school).length >= 1 },
    { key: "Availability set",     weight: 1,   test: (t) => gridHasAny(t.availability) },
    { key: "Service area",         weight: 1,   test: (t) => !!t.serviceArea?.suburb },
  ],

  // Shown in the /settings completion checklist (ticks green once an admin
  // approves — see app/api/verification/approve), but deliberately NOT counted
  // toward the percentage: verification is admin-gated, so a tutor must still be
  // able to reach 100% on their own. Ranking still rewards it via VERIFIED_BOOST.
  uncountedCriteria: [
    { key: "Verified", test: (t) => !!t.verified },
  ],

  // No completion items are parked "coming soon" anymore — verification is live.
  soonCriteria: [],

  // How equal-score tutors are ordered. "random" = fresh each call (the order
  // reshuffles every page load). Add other strategies in TIE_BREAKERS below and
  // point this at one of them.
  tieBreaker: "random",
};
// ─────────────────────────────────────────────────────────────────────────────

// Verification is a trust signal, not a completeness signal, so it lives OUTSIDE
// `criteria` (which feeds the /settings meter — keeping it out means 100% stays
// reachable without being verified, and the "Verified — coming soon" chip stays
// dormant). Instead it's a flat boost added to the ranking score only. The value
// is deliberately larger than the maximum possible completion score (the sum of
// all criteria weights is 16 today), so ANY verified tutor outranks EVERY
// unverified one regardless of how complete their profile is.
export const VERIFIED_BOOST = 1000;

// Tie-break strategies. Each returns a comparator over the card objects passed
// to rankTutors. Selected by RANKING_CONFIG.tieBreaker.
const TIE_BREAKERS = {
  // Fresh randomness on every call — pre-roll a key per card so the comparator
  // stays consistent within a single sort.
  random: (cards) => {
    const roll = new Map(cards.map((card) => [card, Math.random()]));
    return (a, b) => roll.get(a) - roll.get(b);
  },
};

/**
 * Binary completion summary for the /settings meter.
 * Returns { checks, done, total, pct } — `checks` includes the soon items
 * (excluded from `done`/`total`) so the meter checklist renders unchanged.
 */
export function completionScore(t) {
  const counted = RANKING_CONFIG.criteria.map((c) => ({ key: c.key, ok: !!c.test(t) }));
  // Shown in the checklist but excluded from done/total (e.g. Verified).
  const uncounted = (RANKING_CONFIG.uncountedCriteria ?? []).map((c) => ({ key: c.key, ok: !!c.test(t) }));
  const soon = RANKING_CONFIG.soonCriteria.map((c) => ({ key: c.key, ok: !!c.test(t), soon: true }));
  const checks = [...counted, ...uncounted, ...soon];
  const done = counted.filter((c) => c.ok).length;
  const total = counted.length;
  return { checks, done, total, pct: Math.round((done / total) * 100) };
}

/**
 * Weighted ranking score for ordering. Equals `completionScore(t).done` while
 * every weight is 1; diverges once weights are tuned in RANKING_CONFIG.
 */
export function rankingScore(t) {
  if (!t) return 0;
  const base = RANKING_CONFIG.criteria.reduce(
    (sum, c) => (c.test(t) ? sum + c.weight : sum),
    0
  );
  return base + (t.verified ? VERIFIED_BOOST : 0);
}

/**
 * The single ordering entry point used by `/` and `/browse`.
 * Sorts a fresh copy of `cards` by ranking score (descending), breaking ties
 * with the configured strategy. Each card must carry a `completion` object
 * (attached by tutorRowToCard in lib/supabase/tutors.js).
 */
export function rankTutors(cards) {
  const list = Array.isArray(cards) ? cards.slice() : [];
  const tieBreak = (TIE_BREAKERS[RANKING_CONFIG.tieBreaker] ?? TIE_BREAKERS.random)(list);
  const score = new Map(list.map((card) => [card, rankingScore(card.completion)]));
  return list.sort((a, b) => score.get(b) - score.get(a) || tieBreak(a, b));
}
