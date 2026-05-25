// Canonical K–12 year levels, shared by the settings slider, the browse filter,
// the home hero dropdown, and the public profile card. The integer `value` is
// what travels in the URL (`?year=`) and what tutors store as `year_min`/
// `year_max` (Kindergarten = 0 … Year 12 = 12).

export const YEAR_MIN = 0;
export const YEAR_MAX = 12;

export const YEAR_LEVELS = [
  { value: 0, label: "Kindergarten", short: "K" },
  { value: 1, label: "Year 1", short: "1" },
  { value: 2, label: "Year 2", short: "2" },
  { value: 3, label: "Year 3", short: "3" },
  { value: 4, label: "Year 4", short: "4" },
  { value: 5, label: "Year 5", short: "5" },
  { value: 6, label: "Year 6", short: "6" },
  { value: 7, label: "Year 7", short: "7" },
  { value: 8, label: "Year 8", short: "8" },
  { value: 9, label: "Year 9", short: "9" },
  { value: 10, label: "Year 10", short: "10" },
  { value: 11, label: "Year 11", short: "11" },
  { value: 12, label: "Year 12", short: "12" },
];

const BY_VALUE = new Map(YEAR_LEVELS.map((y) => [y.value, y]));

/** Full label for a single year value: 0 → "Kindergarten", 7 → "Year 7". */
export function yearLabel(value) {
  return BY_VALUE.get(Number(value))?.label ?? "";
}

/**
 * Compact label for a [min, max] range as shown on the profile card / chips:
 *   7, 12 → "Years 7–12"
 *   0, 12 → "Kindergarten – Year 12"
 *   9, 9  → "Year 9"
 *   0, 0  → "Kindergarten"
 * Pure-numeric ranges (no Kindergarten endpoint) collapse to "Years a–b".
 */
export function yearRangeLabel(min, max) {
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return "";
  if (lo === hi) return yearLabel(lo);
  if (lo > 0) return `Years ${lo}–${hi}`;
  // Kindergarten is the low end — spell both ends out.
  return `${yearLabel(lo)} – ${yearLabel(hi)}`;
}
