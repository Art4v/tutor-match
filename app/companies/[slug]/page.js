import { notFound } from "next/navigation";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCompanyBySlug, getMyCompany, listCompanyTutors } from "@/lib/supabase/companies";
import { getCompanyReviews } from "@/lib/supabase/reviews";
import { ReviewsCard } from "@/app/tutor/[slug]/ReviewsCard";
import {
  CompanyHeaderCard,
  CompanyAboutCard,
  CompanyRateCard,
  CompanyLocationCard,
  CompanyTutorsCard,
  EnquireButton,
} from "./CompanyCards";
import { OwnerCompany } from "./OwnerCompany";

export async function generateMetadata({ params }) {
  const supabase = createSupabaseServerClient();
  const company = await getCompanyBySlug(supabase, params.slug);
  if (!company) return { title: "Company not found" };
  return {
    title: `${company.name}, tutoring company`,
    description: company.bio || undefined,
  };
}

export default async function CompanyPage({ params }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Owner view — the company editing their own page. Loaded WITHOUT the
  // visibility filter (getMyCompany is scoped by owner_id, not visibility) so a
  // hidden company stays editable by its owner. Same short-circuit the tutor
  // page uses, and the reason there is one URL rather than a separate editor
  // route: the page shown and the page edited cannot drift apart.
  if (user) {
    const mine = await getMyCompany(supabase, user.id);
    if (mine && mine.slug === params.slug) {
      const [myTutors, myReviews] = await Promise.all([
        listCompanyTutors(supabase, mine.id),
        getCompanyReviews(supabase, mine.id),
      ]);
      return (
        <OwnerCompany initialCompany={mine} initialTutors={myTutors} initialReviews={myReviews} userId={user.id} />
      );
    }
  }

  const company = await getCompanyBySlug(supabase, params.slug);
  // Covers three cases with one 404, all correct: no such company, visibility
  // hidden, or the owning account disabled. An UNCLAIMED company is deliberately
  // NOT one of them — it renders, which is the whole invite model.
  if (!company) return notFound();

  const [tutors, reviews] = await Promise.all([
    listCompanyTutors(supabase, company.id),
    getCompanyReviews(supabase, company.id),
  ]);

  return (
    <div className="bg-[color:var(--paper-card)] bleed-under-nav relative overflow-hidden pb-24">
      <DeskBackdrop />
      <div className="relative z-10 max-w-[1128px] mx-auto px-6 pt-6">
        <CompanyHeaderCard company={company} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-[10px] mt-[10px] items-start">
          {/* min-w-0: a 1fr track is minmax(auto, 1fr), so without it the
              column's min-content width — a single long unbroken word in a bio
              is enough — widens the whole grid past the viewport. Same guard as
              /browse and /tutor/[slug]. */}
          <div className="min-w-0 space-y-[10px]">
            {company.bioLong && <CompanyAboutCard company={company} />}
            <CompanyTutorsCard tutors={tutors} companyName={company.name} />
          </div>

          <aside className="space-y-[10px]">
            <CompanyRateCard company={company} />
            {/* Reviews attach to the COMPANY, never to the individual tutors it
                lists (0067). The same card the tutor sidebar uses, switched to
                its company mode. */}
            <ReviewsCard
              companyId={company.id}
              tutorName={company.name}
              rating={company.rating}
              reviewCount={company.reviewCount}
              reviews={reviews}
            />
            <CompanyLocationCard company={company} />
          </aside>
        </div>
      </div>

      {/* Mobile sticky enquiry bar, mirroring the tutor page's message bar. */}
      {company.websiteUrl && (
        <div
          className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-4 py-3"
          style={{ background: "var(--paper-card)", borderTop: "1px solid var(--paper-line)" }}
        >
          <EnquireButton company={company} />
        </div>
      )}
    </div>
  );
}
