import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFeaturedTutors, getSubjects, getSchools, getVerifiedTutorCount } from "@/lib/supabase/tutors";
import { rankTutors } from "@/lib/ranking";
import { HomeHero } from "@/components/HomeHero";
import { SchoolsMarquee } from "@/components/SchoolsMarquee";
import { HomeFeaturedTutors } from "@/components/HomeFeaturedTutors";
import { HomeHowItWorks } from "@/components/HomeHowItWorks";
import { HomeCta } from "@/components/HomeCta";

const FEATURED_SLOTS = 6;

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const [featuredPool, subjectCatalog, schoolCatalog, verifiedCount] = await Promise.all([
    getFeaturedTutors(supabase, 50),
    getSubjects(supabase),
    getSchools(supabase),
    getVerifiedTutorCount(supabase),
  ]);
  // Order the featured strip by profile completeness (same algorithm as
  // /browse — see lib/ranking.js); equal-completeness tutors are randomized
  // fresh each load.
  const featuredTutors = rankTutors(featuredPool).slice(0, FEATURED_SLOTS);
  // Hero carousel: the verified subset of the ranked featured list. rankTutors
  // floats verified tutors to the top and reshuffles equal-score ties fresh per
  // render, so this is a randomised set of verified tutors each page load.
  const showcaseTutors = featuredTutors.filter((t) => t.verified);

  return (
    <main style={{ background: "var(--paper)" }}>
      <HomeHero catalog={subjectCatalog} schoolCatalog={schoolCatalog} showcaseTutors={showcaseTutors} />
      <SchoolsMarquee />
      <HomeFeaturedTutors tutors={featuredTutors} verifiedCount={verifiedCount} />
      <HomeHowItWorks />
      <HomeCta />
    </main>
  );
}
