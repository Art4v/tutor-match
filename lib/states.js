/**
 * Australian states and territories — the catalog behind the `?state=` browse
 * filter and the home hero's state segment.
 *
 * Shaped `{ slug, name }` like the DB-backed school catalog so `CatalogPicker`
 * takes it unchanged, but this list is STATIC (there is no `states` table). The
 * slug IS the state code, which is also exactly what `tutor_profiles.city`
 * stores (the suburb picker writes the short code — see lib/places.js), so a
 * URL slug can be matched straight against the column.
 */
export const AU_STATES = [
  { slug: "NSW", name: "New South Wales" },
  { slug: "VIC", name: "Victoria" },
  { slug: "QLD", name: "Queensland" },
  { slug: "WA", name: "Western Australia" },
  { slug: "SA", name: "South Australia" },
  { slug: "TAS", name: "Tasmania" },
  { slug: "ACT", name: "Australian Capital Territory" },
  { slug: "NT", name: "Northern Territory" },
];

// "NSW" -> "New South Wales". Unknown codes pass through unchanged so a chip
// never renders empty.
export function stateName(code) {
  if (!code) return "";
  return AU_STATES.find((s) => s.slug === code)?.name ?? code;
}

// Guards the `?state=` param so junk never reaches the query.
export function isStateCode(code) {
  return AU_STATES.some((s) => s.slug === code);
}
