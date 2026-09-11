import Link from "next/link";
import { Icon } from "@/components/Icon";
import { DeskBackdrop } from "@/components/DeskBackdrop";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPartners } from "@/lib/supabase/partners";
import { getSubjects } from "@/lib/supabase/tutors";
import { isStateCode } from "@/lib/states";
import { cardStyle } from "@/app/tutor/[slug]/ProfileCards";
import { PartnerLogo } from "./[slug]/PartnerCards";
import { PartnersFilters } from "./PartnersFilters";

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
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {partners.map((p) => (
                  <li key={p.id}>
                    <PartnerCard partner={p} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PartnerCard({ partner }) {
  const location = [partner.suburb, partner.city].filter(Boolean).join(", ");
  return (
    <Link
      href={`/partners/${partner.slug}`}
      className="flex flex-col h-full bg-[color:var(--paper-card)] overflow-hidden transition-colors hover:bg-slate-50"
      style={cardStyle}
    >
      <div
        style={{
          height: 84,
          background: partner.bannerImg
            ? `url(${partner.bannerImg}) center / cover no-repeat`
            : `linear-gradient(135deg, ${partner.bannerBg ?? partner.avatarBg ?? "var(--accent-softer)"}, oklch(0.96 0.01 250))`,
        }}
      />
      <div className="px-5 pb-5 flex-1 flex flex-col" style={{ marginTop: -28 }}>
        <PartnerLogo partner={partner} size={56} ring />
        <h2
          className="text-[19px] leading-tight mt-3"
          style={{ fontWeight: 300, letterSpacing: "-0.02em", color: "var(--ink-graphite)" }}
        >
          {partner.name}
        </h2>
        {partner.bio && (
          <p className="text-[13.5px] mt-1.5 line-clamp-2" style={{ color: "var(--ink-muted)" }}>
            {partner.bio}
          </p>
        )}
        <div
          className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mt-auto pt-3.5 text-[12.5px]"
          style={{ color: "var(--ink-muted)" }}
        >
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="map-pin" size={12} /> {location}
            </span>
          )}
          {partner.rating != null && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="star" size={12} /> {partner.rating.toFixed(1)} ({partner.reviewCount})
            </span>
          )}
          {partner.tutorCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="users" size={12} /> {partner.tutorCount}{" "}
              {partner.tutorCount === 1 ? "tutor" : "tutors"}
            </span>
          )}
          {partner.fromPrice != null && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="trending-up" size={12} /> from ${partner.fromPrice}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
