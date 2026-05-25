import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFeaturedTutors, getSubjects } from "@/lib/supabase/tutors";
import { Icon } from "@/components/Icon";
import { TutorCard } from "@/components/TutorCard";
import { Footer } from "@/components/Footer";
import { HomeHero } from "@/components/HomeHero";
import { HomeHowItWorks } from "@/components/HomeHowItWorks";
import { HomeCta } from "@/components/HomeCta";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const [featuredTutors, subjectCatalog] = await Promise.all([
    getFeaturedTutors(supabase, 9),
    getSubjects(supabase),
  ]);

  return (
    <div className="bg-white">
      <HomeHero catalog={subjectCatalog} />

      <section className="max-w-[1200px] mx-auto px-6 mt-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-[24px] font-semibold text-slate-900 tracking-tight">Browse our Tutors</h2>
            <p className="text-[14px] text-slate-500 mt-1">
              {featuredTutors.length > 0
                ? "Have a look at all the tutors currently listed."
                : "No tutors have published their profiles yet — check back soon."}
            </p>
          </div>
          <Link
            href="/browse"
            className="text-[13.5px] text-slate-700 hover:text-slate-900 hidden md:inline-flex items-center gap-1"
          >
            See all<Icon name="arrow-right" size={13} />
          </Link>
        </div>

        {featuredTutors.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredTutors.map((t) => (
              <TutorCard key={t.id} tutor={t} />
            ))}
          </div>
        )}
      </section>

      <HomeHowItWorks />
      <HomeCta />
      <Footer />
    </div>
  );
}
