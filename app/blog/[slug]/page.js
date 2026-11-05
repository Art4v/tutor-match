import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getArticleBySlug, getRelatedArticles, formatArticleDate } from "@/lib/blog";
import { ArticleSections } from "./ArticleSections";
import { ArticleByline } from "./ArticleByline";
import { ArticleToc } from "./ArticleToc";
import { RelatedArticles } from "./RelatedArticles";
import { JsonLd } from "@/components/JsonLd";
import { articleJsonLd } from "@/lib/seo/schema";

export async function generateMetadata({ params }) {
  const article = await getArticleBySlug(createSupabaseServerClient(), params.slug);
  // Returning {} on a miss leaves the root layout's defaults in place, the same
  // way /tutor/[slug] does; the page below is what actually 404s.
  return article
    ? { title: article.title, description: article.excerpt, alternates: { canonical: `/blog/${article.slug}` } }
    : {};
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
    <div className="bg-surface scroll-smooth">
      <JsonLd data={articleJsonLd(article)} />
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-8 sm:pt-12 pb-16">
        {/* The header spans both columns; below it the body keeps the header's
            left edge and the chapter rail sticks to its right. The rail stays
            BEFORE the body in source order so that when this stacks below lg it
            reads as an intro contents block rather than a footnote; `order` is
            what puts it on the right on wide screens. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-x-12 gap-y-8">
          <header className="lg:col-span-2">
            {article.category && (
              <div className="text-[14px] leading-5 mb-2 text-[color:var(--text-2)]">
                {article.category}
              </div>
            )}
            {/* Same h1 treatment as the /blog index, so the two pages read as
                one type system. Change both together. */}
            <h1 className="text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-semibold max-w-[860px] text-[color:var(--text)]">
              {article.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-5 text-muted">
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

            <p className="mt-6 text-[16px] leading-6 max-w-[65ch] text-[color:var(--text-2)]">
              {article.excerpt}
            </p>
          </header>

          {/* self-start is what makes the sticky work: a stretched grid item is
              already as tall as its row, so it has nothing to stick within. The
              max-height keeps a long chapter list scrollable inside the rail. */}
          <aside className="lg:order-2 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <ArticleToc sections={article.sections} />
          </aside>

          <div className="min-w-0 max-w-[65ch] lg:order-1">
            {/* Shared with the editor's preview, so what an author checks is
                literally what publishes. See ArticleSections.jsx. */}
            <ArticleSections sections={article.sections} />

            <div className="mt-16">
              <RelatedArticles articles={related} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
