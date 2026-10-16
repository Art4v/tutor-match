// ============================================================================
// The site's canonical origin.
// ----------------------------------------------------------------------------
// One definition, read by the root layout's metadataBase and by everything that
// has to emit a full URL rather than a path: sitemap entries, canonical tags and
// JSON-LD, none of which accept a relative URL.
//
// Hardcoded rather than read from the request on purpose. A canonical URL must
// not change with whichever host a crawler happened to reach (a Vercel preview
// URL, the bare domain), or the same page gets indexed twice.
// ============================================================================

export const SITE_URL = "https://www.matchtutor.com.au";

// The default meta description (root layout) and the Organization description
// in the home page's JSON-LD. One sentence, factual.
export const SITE_DESCRIPTION =
  "A directory for high school students looking for serious, verified tutors across Australia.";

// "/tutor/jane-doe" -> "https://www.matchtutor.com.au/tutor/jane-doe".
// A leading slash is added when missing so callers can't produce
// "...com.aututor/x".
export function absUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
