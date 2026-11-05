import { notFound } from "next/navigation";
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
} from "./CompanyCards";
import { OwnerCompany } from "./OwnerCompany";
import { JsonLd } from "@/components/JsonLd";
import { companyJsonLd } from "@/lib/seo/schema";

export async function generateMetadata({ params }) {
  const supabase = createSupabaseServerClient();
  const company = await getCompanyBySlug(supabase, params.slug);
  if (!company) return { title: "Company not found" };
  return {
    title: `${company.name}, tutoring company`,
    description: company.bio || undefined,
    alternates: { canonical: `/companies/${company.slug}` },
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

  // Same structure as the tutor profile (REDESIGN_DECISIONS.md item 6): header,
  // main-column sections, and a contact column that sticks on the right from
  // 1024px and sits inline under the header below (first in source order for
  // that reason). No fixed bottom bar.
  return (
    <div className="bg-surface">
      <JsonLd data={companyJsonLd(company)} />
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-6 pb-16">
        <CompanyHeaderCard company={company} />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_344px] lg:gap-x-12">
          <aside className="pt-6 lg:col-start-2 lg:row-start-1 lg:mt-6 lg:pt-0 lg:sticky lg:top-20 lg:self-start">
            <CompanyRateCard company={company} />
          </aside>

          {/* min-w-0: a 1fr track is minmax(auto, 1fr), so without it the
              column's min-content width (a single long unbroken word in a bio
              is enough) widens the whole grid past the viewport. */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            {company.bioLong && <CompanyAboutCard company={company} />}
            <CompanyTutorsCard tutors={tutors} companyName={company.name} />
            {/* Reviews attach to the COMPANY, never to the individual tutors it
                lists (0067). The same section the tutor profile uses, switched
                to its company mode. */}
            <ReviewsCard
              companyId={company.id}
              tutorName={company.name}
              rating={company.rating}
              reviewCount={company.reviewCount}
              reviews={reviews}
            />
            <CompanyLocationCard company={company} />
          </div>
        </div>
      </div>
    </div>
  );
}
