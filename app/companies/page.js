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

// Shows the "Invite a company" button. Display only: /companies/invite and its
// RPCs re-check the flag (0068), so hiding the button is not the gate.
async function viewerCanInvite(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("can_invite_companies")
    .eq("id", user.id)
    .maybeSingle();
  return Boolean(data?.can_invite_companies);
}

export default async function CompaniesPage({ searchParams }) {
  const supabase = createSupabaseServerClient();

  // URL is the source of truth, same contract as /browse: shareable and
  // back-button-friendly. Junk state codes are dropped up front.
  const q = (searchParams?.q ?? "").toString();
  const states = asArray(searchParams?.state).filter(isStateCode);
  const subjectSlugs = asArray(searchParams?.subject);

  const [companies, catalog, canInvite] = await Promise.all([
    listCompanies(supabase, { q, states, subjectSlugs }),
    getSubjects(supabase),
    viewerCanInvite(supabase),
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
            {canInvite && (
              <div className="flex justify-end mb-4">
                <Link
                  href="/companies/invite"
                  className="inline-flex items-center gap-2 text-[14px] font-medium text-white"
                  style={{ background: "var(--accent)", borderRadius: 9, height: 38, padding: "0 16px" }}
                >
                  <Icon name="plus" size={16} /> Invite a company
                </Link>
              </div>
            )}
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
