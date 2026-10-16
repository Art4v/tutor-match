// ============================================================================
// Data for the /tutors landing pages, shared by all four routes.
// ----------------------------------------------------------------------------
// Everything reads through the cookieless public client so the routes can be
// cached (`revalidate = 3600`), and everything is computed from ONE list,
// listIndexableTutors, so a page's counts, its cards, the sitemap and llms.txt
// cannot disagree about who is listed.
//
// The cards themselves still come from getTutorsForBrowse (restricted to the
// computed ids) so they are ranked exactly like /browse, but with a FIXED seed:
// /browse rerolls its tie-break seed for every cookieless visitor, and a
// crawler should see the same page every time it looks.
// ============================================================================

import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { listIndexableTutors, getSubjects, getTutorsForBrowse } from "@/lib/supabase/tutors";
import { isStateCode, stateName } from "@/lib/states";
import { cityBySlug } from "@/lib/cities";
import { subjectLabel } from "@/lib/subjects";
import {
  MIN_INDEXABLE,
  cityMembers,
  teachesSubject,
  indexableCombos,
  landingStats,
  landingFaq,
  landingSummary,
  tutorsPath,
} from "@/lib/seo/landing";

export const LANDING_SEED = 20261014;
const LOCAL_CARDS = 24;
const ONLINE_CARDS = 12;

// Request-scoped so generateMetadata and the page share one fetch.
export const getIndexableTutors = cache(() =>
  listIndexableTutors(createSupabasePublicClient())
);
const getCatalog = cache(() => getSubjects(createSupabasePublicClient()));

/**
 * Resolve a landing URL to everything the page renders. Returns null for a URL
 * that should 404: unknown state, a [place] that is neither a city in that
 * state nor a catalog subject, or a subject under something that isn't a city.
 *
 * A valid page with too few tutors is NOT a 404; it renders with
 * `indexable: false` and is noindexed.
 */
export const resolveLanding = cache(async (stateParam, placeParam = null, subjectParam = null) => {
  const state = String(stateParam ?? "").toUpperCase();
  if (!isStateCode(state)) return null;

  const catalog = await getCatalog();
  const findSubject = (slug) => catalog.find((s) => s.slug === slug) ?? null;

  let city = null;
  let subject = null;
  if (placeParam) {
    city = cityBySlug(state, placeParam);
    // A subject added later with a city's slug would be silently shadowed here
    // (the city wins). lib/cities.js guards the known namespace at load time;
    // this catches the case its static list cannot.
    if (city && findSubject(placeParam)) {
      console.error(`/tutors: subject slug "${placeParam}" collides with a city and is unreachable`);
    }
    if (!city) {
      if (subjectParam) return null; // a subject only nests under a city
      subject = findSubject(placeParam);
      if (!subject) return null;
    }
  }
  if (subjectParam) {
    subject = findSubject(subjectParam);
    if (!subject) return null;
  }

  const tutors = await getIndexableTutors();
  const bySubject = (list) => (subject ? list.filter((t) => teachesSubject(t, subject.slug)) : list);

  let local;
  let online = [];
  if (city) {
    const members = cityMembers(tutors, city);
    local = bySubject(members.local);
    online = bySubject(members.online);
  } else {
    local = bySubject(tutors.filter((t) => t.state === state));
  }

  const place = city ? city.name : stateName(state);
  const label = subject ? subjectLabel({ name: subject.name, exam: subject.exam }) : null;
  const stats = landingStats(local);
  const onlineCount = online.length;

  // Child links: only pages that are themselves indexable, so every link a
  // crawler follows from here lands on a real page.
  const combos = indexableCombos(tutors);
  let children = [];
  if (!city && !subject) {
    children = [
      ...combos.cities
        .filter((c) => c.city.state === state && c.indexable)
        .map((c) => ({ label: `${c.city.name}`, path: tutorsPath(state, { city: c.city.slug }), count: c.count })),
      ...combos.subjects
        .filter((c) => c.state === state && c.indexable)
        .map((c) => ({ label: subjectLabel(c), path: tutorsPath(state, { subject: c.slug }), count: c.count })),
    ];
  } else if (!city && subject) {
    children = combos.citySubjects
      .filter((c) => c.city.state === state && c.slug === subject.slug && c.indexable)
      .map((c) => ({ label: `${label} in ${c.city.name}`, path: tutorsPath(state, { city: c.city.slug, subject: c.slug }), count: c.count }));
  } else if (city && !subject) {
    children = combos.citySubjects
      .filter((c) => c.city === city && c.indexable)
      .map((c) => ({ label: subjectLabel(c), path: tutorsPath(state, { city: city.slug, subject: c.slug }), count: c.count }));
  }

  const crumbs = [
    { name: "Tutors", path: "/tutors" },
    { name: stateName(state), path: tutorsPath(state) },
  ];
  if (city) crumbs.push({ name: city.name, path: tutorsPath(state, { city: city.slug }) });
  if (subject) crumbs.push({ name: label, path: tutorsPath(state, { city: city?.slug, subject: subject.slug }) });

  const browse = new URLSearchParams();
  if (city) {
    browse.set("lat", String(city.lat));
    browse.set("lng", String(city.lng));
    browse.set("place", city.name);
  } else {
    browse.set("state", state);
  }
  if (subject) browse.set("subject", subject.slug);

  return {
    state,
    city,
    subject,
    place,
    label,
    path: crumbs[crumbs.length - 1].path,
    parentPath: crumbs[crumbs.length - 2].path,
    title: `${label ? `${label} tutors` : "Private tutors"} in ${place}`,
    summary: landingSummary({ place, subject: label, stats, onlineCount }),
    faq: landingFaq({ place, subject: label, stats, onlineCount }),
    indexable: local.length >= MIN_INDEXABLE,
    localIds: local.map((t) => t.id),
    onlineIds: online.map((t) => t.id),
    stats,
    onlineCount,
    children,
    crumbs,
    browseHref: `/browse?${browse.toString()}`,
  };
});

// Ranked cards for a resolved page: local first, then (city pages) online.
export async function getLandingCards(landing) {
  const supabase = createSupabasePublicClient();
  const opts = { verifiedOnly: true, seed: LANDING_SEED };
  const [local, online] = await Promise.all([
    getTutorsForBrowse(supabase, { ...opts, ids: landing.localIds, pageSize: LOCAL_CARDS }),
    landing.city
      ? getTutorsForBrowse(supabase, { ...opts, ids: landing.onlineIds, pageSize: ONLINE_CARDS })
      : { tutors: [], total: 0 },
  ]);
  return { local: local.tutors, online: online.tutors };
}

export function landingMetadata(landing) {
  return {
    title: landing.title,
    description: landing.summary,
    alternates: { canonical: landing.path },
    openGraph: { title: `MatchTutor · ${landing.title}`, description: landing.summary, url: landing.path },
    // Thin pages still render (and are linked) but stay out of the index.
    ...(landing.indexable ? {} : { robots: { index: false, follow: true } }),
  };
}
