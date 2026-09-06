import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getArticles } from "@/lib/blog";
import { ArticleCard } from "./ArticleCard";
import { CtaBand } from "./CtaBand";

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
    <div className="bg-[color:var(--paper-card)]">
      <div className="max-w-[1128px] mx-auto px-6 pt-24 pb-20">
        <header>
          {/* Handwritten eyebrow, the same 26px/weight-400 accent treatment as
              the "How it works" and CTA eyebrows. See the typography note in
              CLAUDE.md before adding another `.font-hand` use. */}
          <div className="font-hand text-[26px] mb-1.5" style={{ color: "var(--accent)", fontWeight: 400 }}>
            The MatchTutor Blog
          </div>
          {/* Same h1 treatment as an article page, so the two read as one type
              system. Change both together. */}
          <h1
            className="text-[36px] sm:text-[44px] leading-[1.12]"
            style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
          >
            Guides for students and parents
          </h1>
          <p className="mt-5 text-[16px] leading-[1.65] max-w-[640px]" style={{ color: "var(--ink-muted)" }}>
            Practical writing on the HSC, the VCE, ATAR scaling and how to study, from the tutors who
            sat these courses recently.
          </p>
        </header>

        {articles.length === 0 ? (
          <p className="mt-16 text-[15px]" style={{ color: "var(--ink-muted)" }}>
            No articles have been published yet. Check back soon.
          </p>
        ) : (
          // Two per row from md up. Each card is its own grid item and renders
          // straight in, with no enter-view animation.
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-14">
            {articles.map((article) => (
              <article key={article.slug}>
                <ArticleCard article={article} />
              </article>
            ))}
          </div>
        )}

      </div>

      {/* Full-bleed, outside the article container, so it reads as the same
          closing slice as the home page's CTA rather than a card on the page. */}
      <CtaBand
        eyebrow="For students."
        title="Ready to find your tutor?"
        body="Browse verified tutors by performance, subject, location and rate, and find the perfect tutor for you."
        primary={{ label: "Browse tutors", href: "/browse" }}
        secondary={{ label: "Become a tutor", href: "/signup" }}
      />
    </div>
  );
}
