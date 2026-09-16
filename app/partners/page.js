import Link from "next/link";
import { Icon } from "@/components/Icon";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPartners } from "@/lib/supabase/partners";
import { getSubjects } from "@/lib/supabase/tutors";
import { isStateCode } from "@/lib/states";
import { cardStyle } from "@/app/tutor/[slug]/ProfileCards";
import { PartnerCard } from "@/components/PartnerCard";
import { PartnersFilters } from "./PartnersFilters";
import { PartnersFeed, PartnersFeedItem } from "./PartnersFeed";

export const metadata = {
  title: "Partners — tutoring centres",
  description: "Tutoring centres listed on MatchTutor.",
};

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function PartnersPage({ searchParams }) {
  const supabase = createSupabaseServerClient();

  // URL is the source of truth, same contract as /browse: shareable and
  // back-button-friendly. Junk state codes are dropped up front.
  const q = (searchParams?.q ?? "").toString();
  const states = asArray(searchParams?.state).filter(isStateCode);
  const subjectSlugs = asArray(searchParams?.subject);

  const [partners, catalog] = await Promise.all([
    listPartners(supabase, { q, states, subjectSlugs }),
    getSubjects(supabase),
  ]);

  const hasFilters = q !== "" || states.length > 0 || subjectSlugs.length > 0;

  return (
    <div className="desk-surface bleed-under-nav relative">
      <DeskBackdrop className="-z-10" />
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
          <PartnersFilters
            catalog={catalog}
            filters={{ q, states, subjectSlugs }}
            totalCount={partners.length}
          />

          <div className="min-w-0">
            {partners.length === 0 ? (
              <div
                className="bg-[color:var(--paper-card)] text-center py-16 px-6"
                style={cardStyle}
              >
                <h2 className="text-[22px] font-light text-slate-800 tracking-tight">
                  No centres match those filters
                </h2>
                <p className="text-[14px] text-slate-500 mt-1.5">
                  {hasFilters
                    ? "Try widening your search."
                    : "We're adding tutoring centres now. Check back soon."}
                </p>
                {hasFilters && (
                  <Link
                    href="/partners"
                    className="inline-flex items-center gap-1.5 text-[13.5px] font-medium mt-4"
                    style={{ color: "var(--accent)" }}
                  >
                    Clear all filters <Icon name="arrow-right" size={14} />
                  </Link>
                )}
              </div>
            ) : (
              <PartnersFeed>
                {partners.map((p) => (
                  <PartnersFeedItem key={p.id}>
                    <PartnerCard partner={p} />
                  </PartnersFeedItem>
                ))}
              </PartnersFeed>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
