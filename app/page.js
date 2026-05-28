import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFeaturedTutors, getSubjects, getPublicTutorCount } from "@/lib/supabase/tutors";
import { Footer } from "@/components/Footer";
import { HomeHero } from "@/components/HomeHero";
import { HomeFeaturedTutors } from "@/components/HomeFeaturedTutors";
import { HomeHowItWorks } from "@/components/HomeHowItWorks";
import { HomeCta } from "@/components/HomeCta";

const FEATURED_SLOTS = 6;
const PINNED_TUTOR_NAME = "Aarav Bhatt";

function pinAndShuffleFeatured(pool) {
  const pinned = pool.find((t) => t.name === PINNED_TUTOR_NAME) ?? null;
  const rest = pool.filter((t) => t !== pinned);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const picks = pinned ? [pinned, ...rest.slice(0, FEATURED_SLOTS - 1)] : rest.slice(0, FEATURED_SLOTS);
  return picks;
}

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const [featuredPool, subjectCatalog, totalTutors] = await Promise.all([
    getFeaturedTutors(supabase, 50),
    getSubjects(supabase),
    getPublicTutorCount(supabase),
  ]);
  const featuredTutors = pinAndShuffleFeatured(featuredPool);

  return (
    <main className="bg-white snap-scroll">
      <HomeHero catalog={subjectCatalog} />
      <HomeFeaturedTutors tutors={featuredTutors} totalTutors={totalTutors} />
      <HomeHowItWorks />
      <HomeCta />
      <Footer />
    </main>
  );
}
