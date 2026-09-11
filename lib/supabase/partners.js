// ============================================================================
// Partner (tutoring centre) data access.
// ----------------------------------------------------------------------------
// The ONLY path to partner data, exactly as lib/supabase/tutors.js is for
// tutors and lib/blog.js is for articles. Every read takes a supabase client as
// its first argument so the caller decides whose RLS applies.
//
// Reads return a camelCase object; the DB stays snake_case. Visibility is NOT
// re-checked in JS: the 0063 policies already hide a hidden partner and a
// partner whose owner is disabled, and an unclaimed partner is deliberately
// visible (that is the whole invite model).
// ============================================================================

const PARTNER_SELECT = `
  id, slug, name, website_url, bio, bio_long, suburb, city,
  service_lat, service_lng, logo_url, banner_url, avatar_bg, banner_bg,
  initials, visibility, owner_id,
  packages:partner_packages ( label, price, position )
`;

function partnerRowToDetail(row) {
  if (!row) return null;
  const packages = [...(row.packages ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((p) => ({ label: p.label, price: p.price }));

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    websiteUrl: row.website_url ?? null,
    bio: row.bio ?? "",
    bioLong: row.bio_long ?? "",
    suburb: row.suburb ?? "",
    city: row.city ?? "",
    serviceLat: row.service_lat ?? null,
    serviceLng: row.service_lng ?? null,
    logoImg: row.logo_url ?? null,
    bannerImg: row.banner_url ?? null,
    avatarBg: row.avatar_bg ?? null,
    bannerBg: row.banner_bg ?? null,
    initial: row.initials ?? (row.name ? row.name.charAt(0).toUpperCase() : "?"),
    visibility: row.visibility ?? "public",
    ownerId: row.owner_id ?? null,
    // The centre's one rate card. Every tutor listed under it renders these
    // prices rather than a rate of their own (0064).
    packages,
    // Cheapest package, which is what the browse rate filter mirrors in 0064.
    // A plain value, not a getter: these objects cross the server/client
    // boundary and accessors do not survive serialization.
    fromPrice: packages.length ? Math.min(...packages.map((p) => p.price)) : null,
  };
}

/** Public partner page. Returns null when there's no visible match. */
export async function getPartnerBySlug(supabase, slug) {
  if (!slug) return null;
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return partnerRowToDetail(data);
}

/**
 * The partner the signed-in user owns, or null. This is both the "take me to my
 * own page" resolver for /partner and the owner short-circuit on
 * /partners/[slug], so it deliberately ignores visibility — an owner must be
 * able to reach a hidden page in order to unhide it.
 */
export async function getMyPartner(supabase, userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("partners")
    .select(PARTNER_SELECT)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return partnerRowToDetail(data);
}

/**
 * Name + claim state for the invite landing page, read through the SERVICE-ROLE
 * client. It has to bypass RLS: the visitor is typically logged out or brand
 * new, and a `hidden` partner still needs its claim page to work.
 */
export async function getPartnerForClaim(admin, partnerId) {
  if (!admin || !partnerId) return null;
  const { data, error } = await admin
    .from("partners")
    .select("id, slug, name, owner_id")
    .eq("id", partnerId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    claimed: data.owner_id != null,
  };
}
