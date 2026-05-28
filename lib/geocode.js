// Server-side suburb geocoder.
//
// Primary: Nominatim (https://nominatim.openstreetmap.org).
//   Requires a descriptive User-Agent per OSM policy and is rate-limited to
//   ~1 req/sec for the public endpoint.
// Fallback: Photon (https://photon.komoot.io) — also free, also OSM-based,
//   but hosted on different infra so a Nominatim outage / rate-limit doesn't
//   take us out.
//
// Results are cached in-process by lowercased suburb so the editor's debounced
// fetches don't hammer either provider.

const UA = "matchtutor/1.0 (aaravb2007@gmail.com)";
const cache = new Map();

async function tryNominatim(suburb) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=au&q=${encodeURIComponent(suburb)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/json" } });
  if (!res.ok) return null;
  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const lat = parseFloat(arr[0].lat);
  const lng = parseFloat(arr[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function tryPhoton(suburb) {
  const url = `https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(suburb + " Australia")}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) return null;
  const body = await res.json();
  const feat = body?.features?.[0];
  if (!feat?.geometry?.coordinates) return null;
  const [lng, lat] = feat.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export async function geocodeSuburb(suburb) {
  if (!suburb || typeof suburb !== "string") return null;
  const key = suburb.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);

  let result = null;
  try { result = await tryNominatim(key); } catch { /* fall through */ }
  if (!result) {
    try { result = await tryPhoton(key); } catch { /* fall through */ }
  }
  cache.set(key, result);
  return result;
}
