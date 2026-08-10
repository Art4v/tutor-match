import { notFound } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getArticleBySlug, getRelatedArticles, formatArticleDate } from "@/lib/blog";
import { ArticleBody } from "./ArticleBody";
import { ArticleByline } from "./ArticleByline";
import { ArticleToc } from "./ArticleToc";
import { RelatedArticles } from "./RelatedArticles";
import { CtaBand } from "../CtaBand";

export async function generateMetadata({ params }) {
  const article = await getArticleBySlug(createSupabaseServerClient(), params.slug);
  // Returning {} on a miss leaves the root layout's defaults in place, the same
  // way /tutor/[slug] does; the page below is what actually 404s.
  return article ? { title: article.title, description: article.excerpt } : {};
}

export default async function ArticlePage({ params }) {
  const supabase = createSupabaseServerClient();

  const article = await getArticleBySlug(supabase, params.slug);
  if (!article) return notFound();

  const related = await getRelatedArticles(supabase, params.slug, 3);

  // No second lookup to decide whether the byline links: the author embed only
  // returns a tutorSlug when that profile is public and enabled, so having one
  // IS the proof the link resolves. This replaced a per-render getTutorBySlug.
  const authorHref = article.author?.tutorSlug ? `/tutor/${article.author.tutorSlug}` : null;

  return (
    <div className="bg-[color:var(--paper-card)] scroll-smooth">
      <div className="max-w-[1040px] mx-auto px-6 pt-16 pb-20">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: "var(--sage)" }}
        >
          <Icon name="chevron-left" size={14} />
          All articles
        </Link>

        {/* The header spans both columns; below it the body keeps the header's
            left edge and the chapter rail sticks to its right. The rail stays
            BEFORE the body in source order so that when this stacks below lg it
            reads as an intro contents block rather than a footnote; `order` is
            what puts it on the right on wide screens. */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-x-12 gap-y-10">
          <header className="lg:col-span-2">
            {article.category && (
              <div
                className="text-[12px] font-medium uppercase mb-3"
                style={{ color: "var(--accent)", letterSpacing: "0.08em" }}
              >
                {article.category}
              </div>
            )}
            {/* Same h1 treatment as the /blog index, so the two pages read as
                one type system. Change both together. */}
            <h1
              className="text-[36px] sm:text-[44px] leading-[1.12] max-w-[860px]"
              style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
            >
              {article.title}
            </h1>

            <div
              className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]"
              style={{ color: "var(--sage)" }}
            >
              <span>Published {formatArticleDate(article.publishedAt)}</span>
              {article.updatedAt && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>Updated {formatArticleDate(article.updatedAt)}</span>
                </>
              )}
              <span aria-hidden="true">&middot;</span>
              <span>{article.readingMinutes} min read</span>
            </div>

            <div className="mt-6">
              <ArticleByline author={article.author} linkHref={authorHref} />
            </div>

            <p
              className="mt-8 text-[16px] leading-[1.65] max-w-[640px]"
              style={{ color: "var(--ink-muted)" }}
            >
              {article.excerpt}
            </p>
          </header>

          {/* self-start is what makes the sticky work: a stretched grid item is
              already as tall as its row, so it has nothing to stick within. The
              max-height keeps a long chapter list scrollable inside the rail. */}
          <aside className="lg:order-2 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <ArticleToc sections={article.sections} />
          </aside>

          <div className="min-w-0 lg:order-1">
            <div className="text-[15px] text-slate-700 leading-[1.7]">
              {article.sections.map((section) => (
                <section key={section.id} id={section.id} className="mt-12 first:mt-0 scroll-mt-24">
                  <h2
                    className="text-[24px] font-light mb-4"
                    style={{ color: "var(--ink-graphite-deep)", letterSpacing: "-0.015em" }}
                  >
                    {section.heading}
                  </h2>
                  <ArticleBody content={section.content} />
                </section>
              ))}
            </div>

            <div className="mt-16">
              <RelatedArticles articles={related} />
            </div>
          </div>
        </div>
      </div>

      {/* Outside the grid AND the container: full-bleed like the index and the
          home page, and because the rail's sticky range is the grid row it sits
          in, ending that row here is also what makes the rail stop travelling
          once the CTA comes into view. */}
      <CtaBand
        eyebrow="Next step."
        title="Put it into practice"
        body="Browse verified tutors by subject, location and rate, or keep reading the guides."
        primary={{ label: "Browse tutors", href: "/browse" }}
        secondary={{ label: "More guides", href: "/blog" }}
      />
    </div>
  );
}
