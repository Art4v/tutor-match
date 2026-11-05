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
// Header treatment matches /blog (600 h1 on the type scale, secondary lead
// paragraph); change them together. Tutor lists are TutorCard rows in a ruled
// list; "Narrow it down" is a column link list (DESIGN.md "Link lists").
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
    <div className="bg-surface">
      {jsonLd.map((d) => (
        <JsonLd key={d["@type"]} data={d} />
      ))}
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-8 sm:pt-12 pb-16">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex flex-wrap items-center text-[14px] leading-5 text-[color:var(--text-2)]">
            {crumbs.map((c, i) => (
              <li key={c.path} className="inline-flex items-center">
                {i > 0 && (
                  <span aria-hidden="true" className="mx-2 text-muted">
                    /
                  </span>
                )}
                {i === crumbs.length - 1 ? (
                  <span aria-current="page" className="inline-flex items-center min-h-6">
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.path} className="accent-link inline-flex items-center min-h-6">
                    {c.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <header>
          <h1 className="text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-semibold text-[color:var(--text)]">
            {title}
          </h1>
          <p className="mt-3 text-[16px] leading-6 max-w-[680px] text-[color:var(--text-2)]">{summary}</p>
        </header>

        {local.length === 0 && online.length === 0 ? (
          <p className="mt-8 text-[14px] leading-5 text-[color:var(--text-2)]">
            No tutors are listed here yet.{" "}
            <Link href={landing.parentPath} className="accent-link">
              See the wider area
            </Link>
          </p>
        ) : (
          <>
            {local.length > 0 && (
              <section className="mt-8">
                <ul className="border-t border-rule">
                  {local.map((t) => (
                    <li key={t.id} className="border-b border-rule">
                      <TutorCard tutor={t} />
                    </li>
                  ))}
                </ul>
                {stats.count > local.length && (
                  <p className="mt-4 text-[14px] leading-5 text-muted">
                    Showing {local.length} of {stats.count}.
                  </p>
                )}
              </section>
            )}

            {online.length > 0 && (
              <section className="mt-12">
                <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">
                  Also teaching online
                </h2>
                <p className="mt-1 mb-4 text-[14px] leading-5 text-[color:var(--text-2)]">
                  {onlineCount} {onlineCount === 1 ? "tutor teaches" : "tutors teach"} online and can work with
                  students in {landing.place}.
                </p>
                <ul className="border-t border-rule">
                  {online.map((t) => (
                    <li key={t.id} className="border-b border-rule">
                      <TutorCard tutor={t} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <p className="mt-6">
          <Link
            href={browseHref}
            className="accent-link inline-flex items-center min-h-6 text-[14px] leading-5 font-semibold"
          >
            See all tutors with filters
          </Link>
        </p>

        {children.length > 0 && (
          <section className="mt-12 pt-8 border-t border-rule">
            <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">Narrow it down</h2>
            <LinkList items={children} />
          </section>
        )}

        <section className="mt-12 pt-8 border-t border-rule">
          <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">Questions</h2>
          <dl className="mt-4 max-w-[680px]">
            {faq.map((f) => (
              <div key={f.question} className="mt-6 first:mt-0">
                <dt className="text-[16px] leading-6 font-semibold text-[color:var(--text)]">{f.question}</dt>
                <dd className="mt-1 text-[16px] leading-6 text-[color:var(--text-2)]">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

/**
 * HST-style column link list (DESIGN.md "Link lists"): plain underlined text
 * links with the count in muted text, one column on phones, two from 640px and
 * three from 1024px. Shared by every landing page and the /tutors index.
 * `items` are `{ label, path, count }`.
 */
export function LinkList({ items }) {
  return (
    // CSS columns rather than a grid, so the count-sorted list reads DOWN each
    // column like a directory, not across rows.
    <ul className="mt-4 columns-1 sm:columns-2 lg:columns-3 gap-x-8">
      {items.map((it) => (
        <li key={it.path} className="py-1 text-[14px] leading-5 break-inside-avoid">
          <Link href={it.path} className="accent-link accent-link--glow inline-flex items-center min-h-6">
            {it.label}
          </Link>{" "}
          <span className="text-[12px] leading-4 text-muted">({it.count})</span>
        </li>
      ))}
    </ul>
  );
}
