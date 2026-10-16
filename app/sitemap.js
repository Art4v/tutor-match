import { createSupabasePublicClient } from "@/lib/supabase/public";
import { listIndexableTutors } from "@/lib/supabase/tutors";
import { listCompanies } from "@/lib/supabase/companies";
import { getArticles } from "@/lib/blog";
import { indexableCombos, tutorsPath } from "@/lib/seo/landing";
import { absUrl } from "@/lib/site";

// ============================================================================
// /sitemap.xml
// ----------------------------------------------------------------------------
// Every public URL worth indexing. Tutors come from listIndexableTutors, the
// same list llms-full.txt and the /tutors pages use, so the three agree: only
// verified or company tutors, and only landing pages that pass MIN_INDEXABLE
// (city pages count local tutors only). Unverified tutors' profiles stay public
// but are not advertised here.
//
// Cookieless client + revalidate, so a crawler hitting this costs at most one
// set of queries an hour.
// ============================================================================

export const revalidate = 3600;

export default async function sitemap() {
  const supabase = createSupabasePublicClient();
  const [tutors, companies, articles] = await Promise.all([
    listIndexableTutors(supabase),
    listCompanies(supabase),
    getArticles(supabase),
  ]);

  const entry = (path, extra = {}) => ({ url: absUrl(path), ...extra });

  const combos = indexableCombos(tutors);
  const landing = [
    "/tutors",
    ...combos.states.filter((c) => c.indexable).map((c) => tutorsPath(c.state)),
    ...combos.subjects.filter((c) => c.indexable).map((c) => tutorsPath(c.state, { subject: c.slug })),
    ...combos.cities.filter((c) => c.indexable).map((c) => tutorsPath(c.city.state, { city: c.city.slug })),
    ...combos.citySubjects
      .filter((c) => c.indexable)
      .map((c) => tutorsPath(c.city.state, { city: c.city.slug, subject: c.slug })),
  ];

  return [
    entry("/"),
    entry("/browse"),
    entry("/companies"),
    entry("/blog"),
    ...landing.map((p) => entry(p)),
    ...tutors.map((t) => entry(`/tutor/${t.slug}`, t.updatedAt ? { lastModified: t.updatedAt } : {})),
    ...companies.filter((c) => c.slug).map((c) => entry(`/companies/${c.slug}`)),
    ...articles.map((a) =>
      entry(`/blog/${a.slug}`, { lastModified: a.updatedAt || a.publishedAt || undefined })
    ),
  ];
}
