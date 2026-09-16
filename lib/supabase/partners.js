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
  initials, visibility, owner_id, rating, review_count,
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
    // Trigger-derived from approved reviews (0067), never written by the
    // editor: partners_guard_derived pins both columns against a client write.
    rating: row.rating != null ? Number(row.rating) : null,
    reviewCount: row.review_count ?? 0,
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
 * Persist the editor's draft. Mirrors saveTutorProfile's contract exactly:
 * returns { ok: true } or { ok: false, error } and NEVER throws, so a caller
 * can branch on the result instead of wrapping every save in try/catch.
 *
 * Two steps, only the second transactional — the same split saveTutorProfile
 * has, and for the same reason: the slug rename is a separate race-safe RPC.
 */
export async function savePartnerProfile(supabase, partner, prevName = null) {
  const name = (partner.name ?? "").trim();
  if (!name) return { ok: false, error: { message: "Your centre needs a name." } };

  // Rename first, and only on an actual rename — `prevName` is the committed
  // name the editor still holds. Calling it unconditionally would re-derive the
  // slug on every save, which quietly churns the public URL of any centre whose
  // slug carries a collision suffix. assign_partner_slug resolves the target
  // through owner_id, so it can only ever rewrite the caller's own.
  let slug = partner.slug;
  if (prevName != null && name !== prevName.trim()) {
    const { data, error } = await supabase.rpc("assign_partner_slug", { p_name: name });
    if (error) return { ok: false, error };
    if (data) slug = data;
  }

  const payload = {
    profile: {
      name,
      website_url: partner.websiteUrl ?? null,
      bio: partner.bio ?? null,
      bio_long: partner.bioLong ?? null,
      suburb: partner.suburb ?? null,
      city: partner.city ?? null,
      service_lat: partner.serviceLat ?? null,
      service_lng: partner.serviceLng ?? null,
      logo_url: partner.logoImg ?? null,
      banner_url: partner.bannerImg ?? null,
      avatar_bg: partner.avatarBg ?? null,
      banner_bg: partner.bannerBg ?? null,
      initials: partner.initial ?? null,
      visibility: partner.visibility ?? "public",
    },
    packages: (partner.packages ?? [])
      .filter((p) => (p.label ?? "").trim() !== "" && p.price !== "" && p.price != null)
      .map((p) => ({ label: p.label.trim(), price: Number(p.price) })),
  };

  const { error } = await supabase.rpc("save_partner_profile", { p_payload: payload });
  if (error) return { ok: false, error };
  return { ok: true, slug };
}

// How many of a centre's tutors the feed card shows before it defers to the
// centre's own page. Three is enough to show a real roster without one centre
// filling the feed: a compact TutorCard is about 190px tall.
const PREVIEW_TUTOR_LIMIT = 3;

/**
 * The `/partners` directory. A deliberately coarser filter set than /browse:
 * a centre has no ATAR, no year range and no per-tutor rate, so only state,
 * subject and free text apply.
 *
 * Subjects are derived from the centre's TUTORS rather than stored on the
 * partner. That is not a shortcut: a centre teaches exactly what its tutors
 * teach, so a `partner_subjects` table would be a second copy of that fact,
 * free to drift the moment a tutor's subjects changed.
 *
 * Follows getTutorsForBrowse's "resolve ids first, then one .in()" shape for
 * the same reason: the subject relation is two joins away, so filtering it
 * inline would break the count.
 *
 * Tutors come back in two passes. The embed stays DELIBERATELY light and
 * unlimited, because it is what `tutorCount` and the tutor-first sort are
 * counted from; a PostgREST referenced-table limit applies per parent row, so
 * capping it there would cap the count itself. The handful of tutors the card
 * actually renders are then read in one second query, at full card width.
 */
export async function listPartners(supabase, { q = "", states = [], subjectSlugs = [] } = {}) {
  let filteredIds = null;

  if (subjectSlugs.length > 0) {
    const { data: subjectRows } = await supabase
      .from("subjects")
      .select("id")
      .in("slug", subjectSlugs);
    const subjectIds = (subjectRows ?? []).map((r) => r.id);
    if (subjectIds.length === 0) return [];

    const { data: links } = await supabase
      .from("tutor_subjects")
      .select("tutor_id")
      .in("subject_id", subjectIds);
    const tutorIds = [...new Set((links ?? []).map((r) => r.tutor_id))];
    if (tutorIds.length === 0) return [];

    const { data: owners } = await supabase
      .from("tutor_profiles")
      .select("partner_id")
      .in("id", tutorIds)
      .not("partner_id", "is", null);
    filteredIds = [...new Set((owners ?? []).map((r) => r.partner_id))];
    if (filteredIds.length === 0) return [];
  }

  let query = supabase
    .from("partners")
    .select(`${PARTNER_SELECT}, tutors:tutor_profiles ( id, visibility, created_at )`)
    .eq("visibility", "public")
    // Oldest first, so a centre shows the same three tutors on every render and
    // every visit. Ordering an embed does not cap it, unlike a referenced limit.
    .order("created_at", { foreignTable: "tutors", ascending: true });

  if (filteredIds) query = query.in("id", filteredIds);
  if (states.length > 0) query = query.in("city", states);
  if (q.trim()) {
    const like = `%${q.trim()}%`;
    query = query.or(`name.ilike.${like},bio.ilike.${like},suburb.ilike.${like}`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const partners = data.map((row) => {
    // Hidden tutors are filtered HERE rather than in the query because 0065
    // lets a centre's owner read their own hidden rows, and an owner browsing
    // the public directory must not see them on a public card.
    const visibleTutors = (row.tutors ?? []).filter((t) => t.visibility === "public");
    return {
      ...partnerRowToDetail(row),
      tutorCount: visibleTutors.length,
      previewIds: visibleTutors.slice(0, PREVIEW_TUTOR_LIMIT).map((t) => t.id),
    };
  });

  // Second pass: the full card shape, for only the rows a card will render.
  // Bounded at PREVIEW_TUTOR_LIMIT per centre however large the rosters are,
  // which is the whole reason this isn't one wider embed.
  const previewIds = partners.flatMap((p) => p.previewIds);
  const cards = await getPartnerTutorCardsByIds(supabase, previewIds);
  const byId = new Map(cards.map((c) => [c.id, c]));

  return partners
    .map(({ previewIds: ids, ...partner }) => ({
      ...partner,
      // Mapped through the id list rather than taking the query's own order, so
      // the cards stay in the centre's oldest-first order.
      previewTutors: ids.map((id) => byId.get(id)).filter(Boolean),
    }))
    // Centres with tutors listed are the useful result, so they lead; within
    // each group, alphabetical. Sorted here rather than in SQL because
    // tutorCount is computed from an embedded relation.
    .sort((a, b) => b.tutorCount - a.tutorCount || a.name.localeCompare(b.name));
}

// ── Partner tutors ──────────────────────────────────────────────────────────
// A partner tutor is an ordinary `tutor_profiles` row with `partner_id` set, so
// these helpers read that table rather than a parallel one. That is the whole
// reason /browse, the cards and /tutor/[slug] need no partner-specific query.

// Shaped to match BROWSE_SELECT (lib/supabase/tutors.js) closely enough that
// `partnerTutorRowToCard` can feed the real <TutorCard>, which is what the
// centre page lists its tutors with. `rate` / `city` / `suburb` are the 0066
// mirrors, so they carry the centre's own figures rather than nulls.
const PARTNER_TUTOR_SELECT = `
  id, slug, bio, bio_long, avatar_url, avatar_bg, banner_url, banner_bg,
  initials, visibility, city, suburb, rate, credentials,
  profile:profiles!inner ( full_name ),
  subjects:tutor_subjects ( position, subject:subjects ( name, slug, exam_code ) )
`;

function partnerTutorRowToCard(row) {
  const subjects = [...(row.subjects ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((s) => s.subject)
    .filter(Boolean)
    .map((s) => ({ name: s.name, slug: s.slug, exam: s.exam_code }));

  const name = row.profile?.full_name ?? "";
  return {
    id: row.id,
    slug: row.slug,
    name,
    bio: row.bio ?? "",
    bioLong: row.bio_long ?? "",
    avatarImg: row.avatar_url ?? null,
    avatarBg: row.avatar_bg ?? null,
    bannerImg: row.banner_url ?? null,
    bannerBg: row.banner_bg ?? null,
    initial: row.initials ?? (name ? name.charAt(0).toUpperCase() : "?"),
    visibility: row.visibility ?? "public",
    city: row.city ?? "",
    suburb: row.suburb ?? "",
    rate: row.rate ?? 0,
    credentials: (row.credentials ?? []).filter((c) => c?.label),
    subjects,
  };
}

/**
 * The tutors a centre lists. Used by the public partner page and by the owner
 * editor, which is why it does NOT filter on visibility: the centre has to see
 * a hidden tutor in order to manage it, and the public page only ever asks for
 * a partner it could already read.
 */
export async function listPartnerTutors(supabase, partnerId) {
  if (!partnerId) return [];
  const { data, error } = await supabase
    .from("tutor_profiles")
    .select(PARTNER_TUTOR_SELECT)
    .eq("partner_id", partnerId)
    .order("position", { foreignTable: "tutor_subjects", ascending: true });
  if (error || !data) return [];
  return data.map(partnerTutorRowToCard);
}

/**
 * The same card shape as listPartnerTutors, for an explicit set of tutors
 * rather than a whole centre. It exists for the /partners feed, which needs a
 * few tutors from EVERY centre on the page and would otherwise run one query
 * per centre.
 *
 * Visibility is the caller's business here, not this helper's: the feed has
 * already filtered on it (see listPartners), and the owner editor deliberately
 * wants hidden rows, exactly as listPartnerTutors leaves that decision out.
 */
export async function getPartnerTutorCardsByIds(supabase, ids) {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await supabase
    .from("tutor_profiles")
    .select(PARTNER_TUTOR_SELECT)
    .in("id", ids)
    .order("position", { foreignTable: "tutor_subjects", ascending: true });
  if (error || !data) return [];
  return data.map(partnerTutorRowToCard);
}

/**
 * Persist one partner tutor. Same never-throws contract as savePartnerProfile.
 * Goes through `save_partner_tutor_profile`, which is scoped by partner
 * ownership rather than `auth.uid() = id` — the tutor's own save path
 * (`save_tutor_profile`) is untouched by any of this.
 */
export async function savePartnerTutor(supabase, tutorId, tutor) {
  const name = (tutor.name ?? "").trim();
  if (!name) return { ok: false, error: { message: "This tutor needs a name." } };

  const payload = {
    name,
    profile: {
      bio: tutor.bio ?? null,
      bio_long: tutor.bioLong ?? null,
      avatar_url: tutor.avatarImg ?? null,
      avatar_bg: tutor.avatarBg ?? null,
      initials: tutor.initial ?? null,
    },
    subjects: (tutor.subjects ?? []).map((s) => (typeof s === "string" ? s : s.slug)),
  };

  const { data, error } = await supabase.rpc("save_partner_tutor_profile", {
    p_tutor_id: tutorId,
    p_payload: payload,
  });
  if (error) return { ok: false, error };
  return { ok: true, droppedSubjects: data?.dropped_subjects ?? [] };
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
