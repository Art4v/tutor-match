import { getArticles } from "@/lib/blog";
import { SectionReveal } from "@/components/anim/SectionReveal";
import { ArticleCard } from "./ArticleCard";
import { CtaBand } from "./CtaBand";

export const metadata = {
  title: "Blog",
  description:
    "Guides on the HSC, the VCE, ATAR scaling and study technique, written by tutors on MatchTutor.",
};

export default async function BlogPage() {
  const articles = await getArticles();

  return (
    <div className="bg-[color:var(--paper-card)]">
      <div className="max-w-[1128px] mx-auto px-6 py-24">
        <header>
          <div
            className="text-[12px] font-medium uppercase mb-3"
            style={{ color: "var(--accent)", letterSpacing: "0.08em" }}
          >
            The MatchTutor blog
          </div>
          <h1
            className="text-[40px] sm:text-[44px] leading-none"
            style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
          >
            Guides for students and parents
          </h1>
          <p className="mt-5 text-[15px] leading-[1.7] max-w-[560px]" style={{ color: "var(--ink-muted)" }}>
            Practical writing on the HSC, the VCE, ATAR scaling and how to study, from the tutors who
            sat these courses recently.
          </p>
        </header>

        {articles.length === 0 ? (
          <p className="mt-16 text-[15px]" style={{ color: "var(--ink-muted)" }}>
            No articles have been published yet. Check back soon.
          </p>
        ) : (
          // Two per row from md up; the reveal wrappers are the grid items, so
          // each card animates in on its own.
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-14">
            {articles.map((article, i) => (
              <SectionReveal key={article.slug} as="article" delay={i % 2 === 0 ? 0 : 0.06}>
                <ArticleCard article={article} />
              </SectionReveal>
            ))}
          </div>
        )}

        <div className="mt-20">
          <CtaBand
            title="Ready to find your tutor?"
            body="Browse verified HSC and VCE tutors by subject, location and rate."
          />
        </div>
      </div>
    </div>
  );
}
