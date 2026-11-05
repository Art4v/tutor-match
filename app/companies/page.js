import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCompanies } from "@/lib/supabase/companies";
import { getSubjects } from "@/lib/supabase/tutors";
import { isStateCode } from "@/lib/states";
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
    <div className="max-w-[1128px] mx-auto px-4 lg:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[256px_minmax(0,1fr)] gap-6 lg:gap-8">
        <CompaniesFilters
          catalog={catalog}
          filters={{ q, states, subjectSlugs }}
          totalCount={companies.length}
        />

        <div className="min-w-0">
          {companies.length === 0 ? (
            // DESIGN.md empty state: one line + one action link.
            <div className="border-t border-rule py-8">
              <p className="text-[14px] leading-5 text-[color:var(--text-2)]">
                {hasFilters
                  ? "No companies match those filters."
                  : "No companies are listed yet."}
              </p>
              <Link
                href={hasFilters ? "/companies" : "/browse"}
                className="inline-flex items-center min-h-6 mt-2 text-[14px] leading-5 font-semibold text-accent hover:text-accent-hover"
              >
                {hasFilters ? "Clear all filters" : "Browse tutors"}
              </Link>
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
  );
}
