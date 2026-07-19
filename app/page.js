import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFeaturedTutors, getSubjects, getSchools, getVerifiedTutorCount } from "@/lib/supabase/tutors";
import { rankTutors } from "@/lib/ranking";
import { HomeHero } from "@/components/HomeHero";
import { SchoolsStrip } from "@/components/SchoolsStrip";
import { FeaturedTutors } from "@/components/FeaturedTutors";
import { HomeHowItWorks } from "@/components/HomeHowItWorks";
import { HomeCta } from "@/components/HomeCta";

// 12 cards, split across the marquee's two rows.
const FEATURED_SLOTS = 12;
// Cap on the verified pool the 12 are drawn from. Deliberately well above the
// current verified count so the draw covers the WHOLE verified population
// rather than a rating-ordered slice of it — raise it if the site outgrows it.
const VERIFIED_POOL = 150;

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const [featuredPool, subjectCatalog, schoolCatalog, verifiedCount] = await Promise.all([
    getFeaturedTutors(supabase, VERIFIED_POOL, null, { verifiedOnly: true }),
    getSubjects(supabase),
    getSchools(supabase),
    getVerifiedTutorCount(supabase),
  ]);
  // Marquee pool: the fetch above already narrowed to verified tutors, so this
  // ranks the whole verified population by the same algorithm as /browse
  // (lib/ranking.js) and takes 12. Every verified tutor carries the same
  // verified boost, so ties are the norm here and rankTutors reshuffles them
  // fresh on each render — that reshuffle IS the randomisation, no extra
  // shuffling needed. Same selection the shelved hero carousel used, drawn from
  // every verified tutor rather than a rating-ordered slice.
  const showcaseTutors = rankTutors(featuredPool).slice(0, FEATURED_SLOTS);

  return (
    <main style={{ background: "var(--paper)" }}>
      <HomeHero catalog={subjectCatalog} schoolCatalog={schoolCatalog} />
      <SchoolsStrip />
      <FeaturedTutors tutors={showcaseTutors} verifiedCount={verifiedCount} />
      <HomeHowItWorks />
      <HomeCta />
    </main>
  );
}
