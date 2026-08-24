// Server-side suburb autocomplete.
//
// Sibling of lib/geocode.js, but tuned for typeahead: it returns a *list* of
// candidate suburbs (with coords) as the user types, rather than resolving a
// single string to one point.
//
// Primary: Photon (https://photon.komoot.io) — purpose-built for autocomplete
//   (incremental, fast, no hard rate limit on the public endpoint).
// Fallback: Nominatim (https://nominatim.openstreetmap.org) — slower and
//   rate-limited to ~1 req/sec, so it's only hit when Photon fails.
//
// Both are public, free, OSM-based, no API key. Results are cached in-process
// by lowercased query so repeated keystrokes don't re-hit the providers.

import { AU_STATES } from "@/lib/states";

const UA = "matchtutor/1.0 (aaravb2007@gmail.com)";
const cache = new Map();

// OSM / Photon return full state names; the UI wants the short form. Built from
// the one state list (lib/states.js) so the browse filter and the codes written
// into tutor_profiles.city can never disagree.
const STATE_ABBR = Object.fromEntries(
  AU_STATES.map((s) => [s.name.toLowerCase(), s.slug])
);

function shortState(state) {
  if (!state) return "";
  return STATE_ABBR[state.trim().toLowerCase()] ?? state;
}

function makeLabel(suburb, state, postcode) {
  const parts = [suburb];
  const tail = [state, postcode].filter(Boolean).join(" ");
  if (tail) parts.push(tail);
  return parts.join(", ");
}

// Drop duplicate localities that share a name+state (OSM often returns the
// suburb node and an administrative boundary for the same place).
function dedupe(places) {
  const seen = new Set();
  const out = [];
  for (const p of places) {
    const key = `${p.suburb}|${p.state}|${p.postcode}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

async function tryPhoton(q, limit) {
  // osm_tag=place restricts to populated-place nodes (suburb/town/village/city)
  // rather than streets or POIs. Photon has no country filter, so we keep only
  // AU results from the response.
  const url = `https://photon.komoot.io/api/?limit=${limit * 2}&lang=en&osm_tag=place&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const body = await res.json();
  const feats = Array.isArray(body?.features) ? body.features : [];
  const out = [];
  for (const f of feats) {
    const pr = f?.properties ?? {};
    if ((pr.countrycode ?? "").toUpperCase() !== "AU") continue;
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords)) continue;
    const [lng, lat] = coords;
    const suburb = pr.name;
    if (!suburb || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const state = shortState(pr.state);
    const postcode = pr.postcode ?? "";
    out.push({ label: makeLabel(suburb, state, postcode), suburb, state, postcode, lat, lng });
  }
  return out;
}

async function tryNominatim(q, limit) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=au&limit=${limit * 2}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) return null;
  const arr = await res.json();
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const r of arr) {
    const addr = r.address ?? {};
    const suburb = addr.suburb || addr.town || addr.village || addr.city || r.name;
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (!suburb || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const state = shortState(addr.state);
    const postcode = addr.postcode ?? "";
    out.push({ label: makeLabel(suburb, state, postcode), suburb, state, postcode, lat, lng });
  }
  return out;
}

/**
 * Search Australian suburbs/localities by free text. Returns up to `limit`
 * matches as `[{ label, suburb, state, postcode, lat, lng }]`, or `[]`.
 * Server-only (calls external geocoders directly).
 */
export async function searchSuburbs(q, limit = 6) {
  if (!q || typeof q !== "string") return [];
  const key = q.trim().toLowerCase();
  if (key.length < 2) return [];
  if (cache.has(key)) return cache.get(key);

  let results = null;
  try { results = await tryPhoton(key, limit); } catch { /* fall through */ }
  if (!results || results.length === 0) {
    try { results = await tryNominatim(key, limit); } catch { /* fall through */ }
  }

  const out = dedupe(results ?? []).slice(0, limit);
  cache.set(key, out);
  return out;
}
