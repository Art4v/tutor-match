import Link from "next/link";
import { TutorCard } from "@/components/TutorCard";
import { JsonLd } from "@/components/JsonLd";
import { absUrl } from "@/lib/site";

// ============================================================================
// The body every /tutors landing page renders. Server component.
// ----------------------------------------------------------------------------
// These pages exist to be read by search engines and AI agents as much as by
// people, so the important facts are plain server-rendered text: the h1, the
// generated summary (every clause a live number, see landingSummary), the cards,
// and a FAQ whose answers are mirrored into FAQPage JSON-LD. Nothing here is
// addressed to AI models.
//
// Header treatment matches /blog (light 300 h1, muted lead paragraph); change
// them together. No Caveat: these are not eyebrows.
// ============================================================================

export function LandingView({ landing, local, online }) {
  const { title, summary, faq, children, crumbs, browseHref, stats, onlineCount } = landing;
  const listed = [...local, ...online];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: absUrl(c.path),
      })),
    },
    listed.length > 0 && {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: title,
      numberOfItems: listed.length,
      itemListElement: listed.map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: t.name,
        url: absUrl(`/tutor/${t.slug}`),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  ].filter(Boolean);

  return (
    <div className="bg-[color:var(--paper-card)]">
      {jsonLd.map((d) => (
        <JsonLd key={d["@type"]} data={d} />
      ))}
      <div className="max-w-[1128px] mx-auto px-6 pt-24 pb-20">
        <nav aria-label="Breadcrumb" className="text-[13px] mb-4" style={{ color: "var(--ink-muted)" }}>
          {crumbs.map((c, i) => (
            <span key={c.path}>
              {i > 0 && <span className="mx-1.5">/</span>}
              {i === crumbs.length - 1 ? (
                <span>{c.name}</span>
              ) : (
                <Link href={c.path} className="hover:underline">
                  {c.name}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <header>
          <h1
            className="text-[36px] sm:text-[44px] leading-[1.12]"
            style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
          >
            {title}
          </h1>
          <p className="mt-5 text-[16px] leading-[1.65] max-w-[720px]" style={{ color: "var(--ink-muted)" }}>
            {summary}
          </p>
        </header>

        {local.length === 0 && online.length === 0 ? (
          <p className="mt-12 text-[15px]" style={{ color: "var(--ink-muted)" }}>
            No tutors are listed here yet.{" "}
            <Link href={landing.parentPath} className="underline" style={{ color: "var(--accent)" }}>
              See the wider area
            </Link>
            .
          </p>
        ) : (
          <>
            {local.length > 0 && (
              <section className="mt-12">
                <div className="flex flex-col gap-4">
                  {local.map((t) => (
                    <TutorCard key={t.id} tutor={t} />
                  ))}
                </div>
                {stats.count > local.length && (
                  <p className="mt-4 text-[14px]" style={{ color: "var(--ink-muted)" }}>
                    Showing {local.length} of {stats.count}.
                  </p>
                )}
              </section>
            )}

            {online.length > 0 && (
              <section className="mt-14">
                <h2 className="text-[24px]" style={{ color: "var(--ink-graphite)", fontWeight: 300 }}>
                  Also teaching online
                </h2>
                <p className="mt-2 mb-6 text-[14px]" style={{ color: "var(--ink-muted)" }}>
                  {onlineCount} {onlineCount === 1 ? "tutor teaches" : "tutors teach"} online and can work with
                  students in {landing.place}.
                </p>
                <div className="flex flex-col gap-4">
                  {online.map((t) => (
                    <TutorCard key={t.id} tutor={t} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <p className="mt-8">
          <Link href={browseHref} className="text-[15px] underline" style={{ color: "var(--accent)", fontWeight: 500 }}>
            See all tutors with filters
          </Link>
        </p>

        {children.length > 0 && (
          <section className="mt-16">
            <h2 className="text-[24px]" style={{ color: "var(--ink-graphite)", fontWeight: 300 }}>
              Narrow it down
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {children.map((c) => (
                <li key={c.path}>
                  <Link
                    href={c.path}
                    className="inline-block px-3.5 py-1.5 text-[14px] rounded-full"
                    style={{ border: "1px solid var(--line)", color: "var(--ink-graphite)", fontWeight: 500 }}
                  >
                    {c.label} <span style={{ color: "var(--ink-muted)", fontWeight: 400 }}>({c.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-16 max-w-[720px]">
          <h2 className="text-[24px]" style={{ color: "var(--ink-graphite)", fontWeight: 300 }}>
            Questions
          </h2>
          <dl className="mt-5">
            {faq.map((f) => (
              <div key={f.question} className="mt-5 first:mt-0">
                <dt className="text-[16px]" style={{ color: "var(--ink-graphite)", fontWeight: 500 }}>
                  {f.question}
                </dt>
                <dd className="mt-1.5 text-[15px] leading-[1.6]" style={{ color: "var(--ink-muted)" }}>
                  {f.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
