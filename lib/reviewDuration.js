// ============================================================================
// Review duration: how long a student has been with a tutor or tutoring centre.
// ----------------------------------------------------------------------------
// Stored as ONE nullable int, reviews.duration_months (0080): the total number
// of months. NULL means "not given"; there is no 0. The review form collects
// years + months in two dropdowns and sends the total.
//
// This file is the single definition of the limit and of the display string,
// shared by the form, /api/reviews, the public review row and the admin pages.
// ============================================================================

export const MAX_DURATION_YEARS = 12;

/** 12 years 11 months. Must match the 0080 CHECK on reviews.duration_months. */
export const MAX_DURATION_MONTHS = MAX_DURATION_YEARS * 12 + 11;

/** True for a value the column accepts (NULL is handled by the caller). */
export function isValidDurationMonths(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_DURATION_MONTHS;
}

/** Total months → { years, months }. Zeros for a missing or invalid value. */
export function splitDuration(totalMonths) {
  if (!isValidDurationMonths(totalMonths)) return { years: 0, months: 0 };
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

function plural(n, unit) {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/**
 * "5 months", "1 year", "1 year 4 months", "2 years". Empty string when there is
 * no duration, so callers can test the result for truthiness.
 *
 * Plain string building on purpose, no Intl: the review row is server-rendered
 * and then hydrated, and both sides must produce identical text (the reason is
 * spelled out in app/tutor/[slug]/ReviewItem.jsx).
 */
export function formatDuration(totalMonths) {
  if (!isValidDurationMonths(totalMonths)) return "";
  const { years, months } = splitDuration(totalMonths);
  return [years > 0 ? plural(years, "year") : "", months > 0 ? plural(months, "month") : ""]
    .filter(Boolean)
    .join(" ");
}
