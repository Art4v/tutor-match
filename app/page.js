import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import {
  getFeaturedTutors,
  getSubjects,
  getPublicTutorCount,
  listIndexableTutors,
} from "@/lib/supabase/tutors";
import { rankTutors } from "@/lib/ranking";
import { indexableCombos, tutorsPath } from "@/lib/seo/landing";
import { subjectLabel } from "@/lib/subjects";
import { stateName } from "@/lib/states";
import { HomeHero } from "@/components/HomeHero";
import { BrowseLinks } from "@/components/home/BrowseLinks";
import { TutorCard } from "@/components/TutorCard";
import { JsonLd } from "@/components/JsonLd";
import { siteJsonLd } from "@/lib/seo/schema";
import { SITE_DESCRIPTION } from "@/lib/site";

// Set here, not in the root layout: a canonical in the layout would be
// inherited by every page that doesn't override it, pointing them all at "/".
export const metadata = { alternates: { canonical: "/" } };

// Rows shown in the home tutor list (REDESIGN_DECISIONS.md item 3.4).
const HOME_ROWS = 25;
// Cap on the verified pool the rows are drawn from. Deliberately well above the
// current verified count so the draw covers the WHOLE verified population
// rather than a rating-ordered slice of it; raise it if the site outgrows it.
const VERIFIED_POOL = 150;
// Subject links shown on the home page (the busiest indexable state+subject
// pages). The state pages link to the rest.
const SUBJECT_LINKS = 15;

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const [featuredPool, subjectCatalog, tutorCount, indexable] = await Promise.all([
    getFeaturedTutors(supabase, VERIFIED_POOL, null, { verifiedOnly: true }),
    getSubjects(supabase),
    getPublicTutorCount(supabase),
    // Cookieless client: the same list the sitemap and /tutors pages read, so
    // every link below lands on a page that exists and is indexable.
    listIndexableTutors(createSupabasePublicClient()),
  ]);
  // Every verified tutor carries the same verified boost, so ties are the norm
  // and rankTutors reshuffles them on each render; that reshuffle is the
  // randomisation (same algorithm as /browse, lib/ranking.js).
  const tutors = rankTutors(featuredPool).slice(0, HOME_ROWS);

  const combos = indexableCombos(indexable);
  const subjectLinks = combos.subjects
    .filter((c) => c.indexable)
    .sort((a, b) => b.count - a.count || subjectLabel(a).localeCompare(subjectLabel(b)))
    .slice(0, SUBJECT_LINKS)
    .map((c) => ({
      label: `${subjectLabel(c)}, ${c.state}`,
      path: tutorsPath(c.state, { subject: c.slug }),
      count: c.count,
    }));
  // Each indexable state, followed by its indexable cities.
  const placeLinks = combos.states
    .filter((s) => s.indexable)
    .flatMap((s) => [
      { label: stateName(s.state), path: tutorsPath(s.state), count: s.count },
      ...combos.cities
        .filter((c) => c.indexable && c.city.state === s.state)
        .map((c) => ({ label: c.city.name, path: tutorsPath(s.state, { city: c.city.slug }), count: c.count })),
    ]);

  return (
    <main className="bg-surface">
      <JsonLd data={siteJsonLd({ description: SITE_DESCRIPTION })} />
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-8 sm:pt-12 pb-16">
        <h1 className="text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-semibold text-[color:var(--text)]">
          Find a tutor in Australia
        </h1>
        {tutorCount > 0 && (
          <p className="mt-2 text-[16px] leading-6 text-[color:var(--text-2)]">
            {tutorCount} {tutorCount === 1 ? "tutor" : "tutors"} listed
          </p>
        )}

        <HomeHero catalog={subjectCatalog} />

        {(subjectLinks.length > 0 || placeLinks.length > 0) && (
          <div className="mt-12 border-t border-rule pt-8">
            <BrowseLinks title="Browse by subject" items={subjectLinks} />
            <BrowseLinks
              title="Browse by state or city"
              items={placeLinks}
              more={{ label: "All locations", path: "/tutors" }}
            />
          </div>
        )}

        {tutors.length > 0 && (
          <section className="mt-12 border-t border-rule pt-8">
            <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">Verified tutors</h2>
            <ul className="mt-4 border-t border-rule">
              {tutors.map((t) => (
                <li key={t.id} className="border-b border-rule">
                  <TutorCard tutor={t} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-6 text-[14px] leading-5">
          <Link
            href="/browse"
            className="inline-flex items-center min-h-6 font-semibold text-accent hover:text-[color:var(--accent-hover)]"
          >
            {tutorCount > 0 ? `See all ${tutorCount} tutors` : "See all tutors"}
          </Link>
        </p>
      </div>
    </main>
  );
}
