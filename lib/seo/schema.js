// ============================================================================
// schema.org JSON-LD builders for the public pages.
// ----------------------------------------------------------------------------
// Plain objects, rendered through components/JsonLd.jsx (the one sanctioned
// dangerouslySetInnerHTML). This is the structured layer search engines and AI
// agents read to quote a tutor accurately: name, subjects, ATAR, location,
// price and rating, each tied to its canonical URL.
//
// Only state what the page itself shows, and omit a field rather than emit an
// empty or placeholder value: a rating with zero reviews or a $0 rate would be
// quoted back as fact.
// ============================================================================

import { absUrl, SITE_URL } from "@/lib/site";
import { subjectLabel } from "@/lib/subjects";
import { AU_STATES } from "@/lib/states";

const CONTEXT = "https://schema.org";
const ORG_ID = `${SITE_URL}/#organization`;

function stateCode(city) {
  return AU_STATES.find((s) => s.slug === city || s.name === city)?.slug ?? null;
}

function postalAddress(suburb, city) {
  const region = stateCode(city);
  if (!suburb && !region) return undefined;
  return {
    "@type": "PostalAddress",
    ...(suburb ? { addressLocality: suburb } : {}),
    ...(region ? { addressRegion: region } : {}),
    addressCountry: "AU",
  };
}

function aggregateRating(rating, count) {
  if (!count || rating == null) return undefined;
  return { "@type": "AggregateRating", ratingValue: rating, reviewCount: count, bestRating: 5, worstRating: 1 };
}

/** Home page: who we are, plus a sitelinks search box pointing at /browse. */
export function siteJsonLd({ description }) {
  return {
    "@context": CONTEXT,
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "MatchTutor",
        url: SITE_URL,
        logo: absUrl("/icon.svg"),
        description,
        areaServed: { "@type": "Country", name: "Australia" },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "MatchTutor",
        url: SITE_URL,
        publisher: { "@id": ORG_ID },
        inLanguage: "en-AU",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${absUrl("/browse")}?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/**
 * Tutor profile: a Person (who) plus the Service they offer (what, where, how
 * much, how rated). aggregateRating lives on the Service because schema.org
 * does not allow it on a Person.
 */
export function tutorJsonLd(tutor) {
  const url = absUrl(`/tutor/${tutor.slug}`);
  const personId = `${url}#person`;
  const subjects = tutor.subjects.map((s) => subjectLabel(s));
  const address = postalAddress(tutor.suburb, tutor.city);
  const schools = tutor.education.filter((e) => e.school).map((e) => ({
    "@type": e.level === "university" ? "CollegeOrUniversity" : "HighSchool",
    name: e.school,
  }));

  const person = {
    "@type": "Person",
    "@id": personId,
    name: tutor.name,
    url,
    jobTitle: "Private tutor",
    ...(tutor.bio ? { description: tutor.bio } : {}),
    ...(tutor.avatarImg ? { image: tutor.avatarImg } : {}),
    ...(subjects.length ? { knowsAbout: subjects } : {}),
    ...(address ? { address } : {}),
    ...(schools.length ? { alumniOf: schools } : {}),
    ...(tutor.atar
      ? {
          hasCredential: {
            "@type": "EducationalOccupationalCredential",
            name: `ATAR ${Number(tutor.atar).toFixed(2)}`,
            credentialCategory: "Australian Tertiary Admission Rank",
          },
        }
      : {}),
    ...(tutor.company
      ? { memberOf: { "@type": "EducationalOrganization", name: tutor.company.name, url: absUrl(`/companies/${tutor.company.slug}`) } }
      : {}),
  };

  const areas = [];
  if (tutor.deliversInPerson && tutor.suburb) areas.push({ "@type": "Place", name: [tutor.suburb, stateCode(tutor.city)].filter(Boolean).join(" ") });
  if (tutor.deliversOnline) areas.push({ "@type": "Country", name: "Australia" });

  const service = {
    "@type": "Service",
    "@id": `${url}#tutoring`,
    name: subjects.length ? `Private tutoring in ${subjects.slice(0, 3).join(", ")}` : "Private tutoring",
    serviceType: "Private tutoring",
    url,
    provider: { "@id": personId },
    ...(areas.length ? { areaServed: areas } : {}),
    // A company tutor has no hourly rate (0069); the company prices by package.
    ...(!tutor.company && tutor.rate > 0
      ? {
          offers: {
            "@type": "Offer",
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: tutor.rate,
              priceCurrency: "AUD",
              unitText: "hour",
            },
          },
        }
      : {}),
    ...(aggregateRating(tutor.rating, tutor.reviews) ? { aggregateRating: aggregateRating(tutor.rating, tutor.reviews) } : {}),
  };

  return { "@context": CONTEXT, "@graph": [person, service] };
}

/** Company page. */
export function companyJsonLd(company) {
  const url = absUrl(`/companies/${company.slug}`);
  const address = postalAddress(company.suburb, company.city);
  const rating = aggregateRating(company.rating, company.reviewCount);
  return {
    "@context": CONTEXT,
    "@type": "EducationalOrganization",
    "@id": `${url}#organization`,
    name: company.name,
    url,
    ...(company.bio ? { description: company.bio } : {}),
    ...(company.logoImg ? { logo: company.logoImg } : {}),
    ...(company.websiteUrl ? { sameAs: [company.websiteUrl] } : {}),
    ...(address ? { address } : {}),
    ...(rating ? { aggregateRating: rating } : {}),
  };
}

/** Blog article. The author links to their profile only when it is public. */
export function articleJsonLd(article) {
  const url = absUrl(`/blog/${article.slug}`);
  return {
    "@context": CONTEXT,
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    url,
    mainEntityOfPage: url,
    ...(article.excerpt ? { description: article.excerpt } : {}),
    ...(article.coverUrl ? { image: article.coverUrl } : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article.updatedAt || article.publishedAt ? { dateModified: article.updatedAt || article.publishedAt } : {}),
    ...(article.author
      ? {
          author: {
            "@type": "Person",
            name: article.author.name,
            ...(article.author.tutorSlug ? { url: absUrl(`/tutor/${article.author.tutorSlug}`) } : {}),
          },
        }
      : {}),
    publisher: { "@id": ORG_ID, "@type": "Organization", name: "MatchTutor", url: SITE_URL },
    inLanguage: "en-AU",
  };
}
