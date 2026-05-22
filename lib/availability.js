// ============================================================================
// Canonical availability-grid labels.
// ----------------------------------------------------------------------------
// The tutor settings editor (app/settings/sections.js) and the public profile's
// AvailabilityGrid (via lib/supabase/tutors.js → normalizeAvailability) both
// label the same 8×7 grid. They used to hardcode *different* hour arrays, so a
// slot a tutor marked "9 am" was shown to students as "8am". These constants are
// the single source of truth — import them in both places.
//
// Plain constants, no client-only deps, so this module is safe to import from
// both "use client" components and server-side code.
// ============================================================================

export const AVAILABILITY_HOURS = ["9 am", "10 am", "11 am", "12 pm", "2 pm", "4 pm", "6 pm", "8 pm"];
export const AVAILABILITY_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
