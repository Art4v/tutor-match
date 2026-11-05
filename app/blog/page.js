import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getArticles } from "@/lib/blog";
import { ArticleCard } from "./ArticleCard";

export const metadata = {
  title: "Blog",
  description:
    "Guides on the HSC, the VCE, ATAR scaling and study technique, written by tutors on MatchTutor.",
};

// Reading articles from Supabase makes this route dynamic (the server client
// reads cookies()), where the file-backed version was static. That matches
// every other server page in the app, and the empty state below now covers an
// unconfigured Supabase as well as an empty table.
export default async function BlogPage() {
  const articles = await getArticles(createSupabaseServerClient());

  return (
    <div className="bg-surface">
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-8 sm:pt-12 pb-16">
        <header>
          {/* Same h1 treatment as an article page, so the two read as one type
              system. Change both together. */}
          <h1 className="text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-semibold text-[color:var(--text)]">
            Guides for students and parents
          </h1>
          <p className="mt-3 text-[16px] leading-6 max-w-[680px] text-[color:var(--text-2)]">
            Practical writing on the HSC, the VCE, ATAR scaling and how to study, from the tutors who
            sat these courses recently.
          </p>
        </header>

        {articles.length === 0 ? (
          <p className="mt-8 text-[14px] leading-5 text-[color:var(--text-2)]">
            No articles have been published yet.{" "}
            <Link href="/browse" className="accent-link">
              Find a tutor
            </Link>
          </p>
        ) : (
          // Two per row from sm up. Each card is its own grid item and renders
          // straight in, with no enter-view animation.
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-12">
            {articles.map((article) => (
              <article key={article.slug}>
                <ArticleCard article={article} />
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
