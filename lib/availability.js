// ============================================================================
// Canonical availability-grid labels.
// ----------------------------------------------------------------------------
// The tutor settings editor (app/settings/sections.js) and the public profile's
// AvailabilityGrid (via lib/supabase/tutors.js → normalizeAvailability) both
// label the same grid. They used to hardcode *different* hour arrays, so a slot
// a tutor marked "9 am" was shown to students as "8am". These constants are the
// single source of truth — import them in both places.
//
// The grid covers the full 24 hours of the day in 1-hour slots: 24 rows
// (12 am, 1 am, … 11 pm) × 7 days. One cell = one full hour.
//
// Plain constants, no client-only deps, so this module is safe to import from
// both "use client" components and server-side code.
// ============================================================================

export const AVAILABILITY_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// 1-hour slots across the full day → 24 rows.
export const SLOT_MINUTES = 60;
export const AVAILABILITY_SLOTS = (24 * 60) / SLOT_MINUTES; // 24
export const AVAILABILITY_DAY_COUNT = AVAILABILITY_DAYS.length; // 7

function buildHourLabels() {
  const out = [];
  for (let h24 = 0; h24 < 24; h24++) {
    const ampm = h24 < 12 ? "am" : "pm";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    out.push(`${h12} ${ampm}`);
  }
  return out;
}

export const AVAILABILITY_HOURS = buildHourLabels();

/** A fresh, all-unavailable grid sized to the canonical dimensions. */
export function buildEmptyGrid() {
  return Array.from({ length: AVAILABILITY_SLOTS }, () =>
    Array(AVAILABILITY_DAY_COUNT).fill(0)
  );
}

/**
 * Coerce any stored grid to the canonical 24×7 shape: pads missing rows/cols
 * with 0 (unavailable) and truncates extras, clamping cell values to 0–2. Lets
 * the editor render legacy/short grids without crashing. Returns a fresh array.
 */
export function normalizeGrid(raw) {
  const base = buildEmptyGrid();
  if (!Array.isArray(raw)) return base;
  for (let r = 0; r < AVAILABILITY_SLOTS; r++) {
    const row = raw[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < AVAILABILITY_DAY_COUNT; c++) {
      const v = row[c];
      base[r][c] = v === 1 || v === 2 ? v : 0;
    }
  }
  return base;
}
