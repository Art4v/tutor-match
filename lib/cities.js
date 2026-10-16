// ============================================================================
// Cities for the /tutors landing pages.
// ----------------------------------------------------------------------------
// STATIC, like lib/states.js: there is no `cities` table and no city column on
// tutor_profiles. A tutor belongs to a city when their saved service location
// (service_lat / service_lng, see 0008) is within `radiusKm` of the city's
// centre. Computed in JS over listIndexableTutors, so no migration and no query.
//
// Centres are METRO CENTROIDS, not CBDs, and radii are deliberately generous so
// a city page means "the greater metro area" the way a parent searching for
// "Sydney" means it. Sydney is centred near Parramatta, not the harbour, which
// is what lets one circle reach Penrith, Campbelltown and the Northern Beaches.
//
// Circles may overlap (Sydney swallows Central Coast and Wollongong on purpose).
// A tutor inside two circles is listed on both pages; that is intended.
//
// Each entry's comment lists suburbs it must include, and where it matters
// exclude. Those lists are the acceptance test when a centre or radius changes.
//
// `slug` shares a URL segment with subject slugs (/tutors/nsw/sydney beside
// /tutors/nsw/hsc-chemistry), so the guard at the bottom refuses any city slug
// that could be mistaken for a subject.
// ============================================================================

export const CITIES = [
  // Must include: Penrith, Campbelltown, Camden, Picton, Palm Beach, Annangrove,
  // Cronulla, Katoomba (Blue Mountains), Gosford (Central Coast), Wollongong.
  { slug: "sydney", name: "Sydney", state: "NSW", lat: -33.82, lng: 150.95, radiusKm: 75 },
  // Must include: Frankston, Melton, Sunbury, Pakenham, Rosebud. Exclude: Geelong.
  { slug: "melbourne", name: "Melbourne", state: "VIC", lat: -37.84, lng: 145.05, radiusKm: 62 },
  // Must include: Ipswich, Redcliffe, Logan, Caboolture. Exclude: Southport.
  { slug: "brisbane", name: "Brisbane", state: "QLD", lat: -27.47, lng: 153.02, radiusKm: 50 },
  // Must include: Joondalup, Rockingham, Armadale, Ellenbrook. Exclude: Mandurah.
  { slug: "perth", name: "Perth", state: "WA", lat: -31.95, lng: 115.86, radiusKm: 50 },
  // Must include: Gawler, Aldinga Beach, Mount Barker.
  { slug: "adelaide", name: "Adelaide", state: "SA", lat: -34.93, lng: 138.6, radiusKm: 45 },
  // Must include: Kingston, Bridgewater, Sorell.
  { slug: "hobart", name: "Hobart", state: "TAS", lat: -42.88, lng: 147.33, radiusKm: 30 },
  // Must include: Belconnen, Tuggeranong, Gungahlin, Queanbeyan (NSW side).
  { slug: "canberra", name: "Canberra", state: "ACT", lat: -35.28, lng: 149.13, radiusKm: 30 },
  // Must include: Palmerston, Casuarina.
  { slug: "darwin", name: "Darwin", state: "NT", lat: -12.46, lng: 130.84, radiusKm: 30 },
  // Must include: Coomera, Southport, Coolangatta. Exclude: Brisbane CBD.
  { slug: "gold-coast", name: "Gold Coast", state: "QLD", lat: -28.02, lng: 153.4, radiusKm: 30 },
  // Must include: Maitland, Lake Macquarie (Charlestown), Raymond Terrace.
  { slug: "newcastle", name: "Newcastle", state: "NSW", lat: -32.93, lng: 151.75, radiusKm: 35 },
  // Must include: Helensburgh, Shellharbour, Kiama.
  { slug: "wollongong", name: "Wollongong", state: "NSW", lat: -34.43, lng: 150.88, radiusKm: 35 },
  // Must include: Gosford, Wyong, The Entrance, Woy Woy.
  { slug: "central-coast", name: "Central Coast", state: "NSW", lat: -33.35, lng: 151.38, radiusKm: 30 },
  // Must include: Caloundra, Maroochydore, Noosa Heads.
  { slug: "sunshine-coast", name: "Sunshine Coast", state: "QLD", lat: -26.65, lng: 153.07, radiusKm: 40 },
  // Must include: Lara, Torquay, Ocean Grove.
  { slug: "geelong", name: "Geelong", state: "VIC", lat: -38.15, lng: 144.36, radiusKm: 25 },
];

export function citiesInState(code) {
  return CITIES.filter((c) => c.state === code);
}

// A city only resolves under its own state, so /tutors/vic/sydney is a 404.
export function cityBySlug(state, slug) {
  return CITIES.find((c) => c.state === state && c.slug === slug) ?? null;
}

// Great-circle distance in km. Same formula as tutors_within_service_radius (0008).
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Guard: a city slug must never look like a subject slug, or the shared
// /tutors/<state>/<place> segment would become ambiguous. Exam subjects are
// prefixed (0009); the TEST group's subjects are bare words, listed here as of
// 2026-10. This static list can go stale when a test is added, so
// app/tutors/data.js also checks the live catalog on every resolve.
const SUBJECT_PREFIX = /^(hsc|vce|ib|qce|sace|wace|tce|act|general)-/;
const TEST_SLUGS = new Set([
  "ucat", "gamsat", "lat", "sat", "act", "isat", "stat", "unitest",
  "esat", "naplan", "ast", "casper", "selective", "oc",
]);
for (const c of CITIES) {
  if (SUBJECT_PREFIX.test(c.slug) || TEST_SLUGS.has(c.slug)) {
    throw new Error(`lib/cities.js: city slug "${c.slug}" collides with the subject slug namespace`);
  }
}
