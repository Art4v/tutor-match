import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFeaturedTutors, getSubjects, getSchools, getVerifiedTutorCount } from "@/lib/supabase/tutors";
import { rankTutors } from "@/lib/ranking";
import { HomeHero } from "@/components/HomeHero";
import { SchoolsMarquee } from "@/components/SchoolsMarquee";
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
  // Hero carousel pool: rank by the same algorithm as /browse (lib/ranking.js),
  // which floats verified tutors to the top and reshuffles equal-score ties
  // fresh each render, then take the verified subset — a randomised set of
  // verified tutors per page load.
  const featuredTutors = rankTutors(featuredPool).slice(0, FEATURED_SLOTS);
  const showcaseTutors = featuredTutors.filter((t) => t.verified);

  return (
    <main style={{ background: "var(--paper)" }}>
      <HomeHero catalog={subjectCatalog} schoolCatalog={schoolCatalog} showcaseTutors={showcaseTutors} verifiedCount={verifiedCount} />
      <SchoolsMarquee />
      <HomeHowItWorks />
      <HomeCta />
    </main>
  );
}
