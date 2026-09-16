import Link from "next/link";
import { Icon } from "@/components/Icon";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCompanies } from "@/lib/supabase/companies";
import { getSubjects } from "@/lib/supabase/tutors";
import { isStateCode } from "@/lib/states";
import { cardStyle } from "@/app/tutor/[slug]/ProfileCards";
import { CompanyCard } from "@/components/CompanyCard";
import { CompaniesFilters } from "./CompaniesFilters";
import { CompaniesFeed, CompaniesFeedItem } from "./CompaniesFeed";

export const metadata = {
  title: "Companies",
  description: "Tutoring companies listed on MatchTutor.",
};

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function CompaniesPage({ searchParams }) {
  const supabase = createSupabaseServerClient();

  // URL is the source of truth, same contract as /browse: shareable and
  // back-button-friendly. Junk state codes are dropped up front.
  const q = (searchParams?.q ?? "").toString();
  const states = asArray(searchParams?.state).filter(isStateCode);
  const subjectSlugs = asArray(searchParams?.subject);

  const [companies, catalog] = await Promise.all([
    listCompanies(supabase, { q, states, subjectSlugs }),
    getSubjects(supabase),
  ]);

  const hasFilters = q !== "" || states.length > 0 || subjectSlugs.length > 0;

  return (
    <div className="desk-surface bleed-under-nav relative">
      <DeskBackdrop className="-z-10" />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
          <CompaniesFilters
            catalog={catalog}
            filters={{ q, states, subjectSlugs }}
            totalCount={companies.length}
          />

          <div className="min-w-0">
            {companies.length === 0 ? (
              <div
                className="bg-[color:var(--paper-card)] text-center py-16 px-6"
                style={cardStyle}
              >
                <h2 className="text-[22px] font-light text-slate-800 tracking-tight">
                  No companies match those filters
                </h2>
                <p className="text-[14px] text-slate-500 mt-1.5">
                  {hasFilters
                    ? "Try widening your search."
                    : "We're adding tutoring companies now. Check back soon."}
                </p>
                {hasFilters && (
                  <Link
                    href="/companies"
                    className="inline-flex items-center gap-1.5 text-[13.5px] font-medium mt-4"
                    style={{ color: "var(--accent)" }}
                  >
                    Clear all filters <Icon name="arrow-right" size={14} />
                  </Link>
                )}
              </div>
            ) : (
              <CompaniesFeed>
                {companies.map((p) => (
                  <CompaniesFeedItem key={p.id}>
                    <CompanyCard company={p} />
                  </CompaniesFeedItem>
                ))}
              </CompaniesFeed>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
