import Link from "next/link";
import { cardStyle } from "@/app/tutor/[slug]/ProfileCards";
import { formatArticleDate } from "@/lib/blog";

// "Keep reading" block at the foot of an article. Selection (same category
// first, then newest) lives in lib/blog.js getRelatedArticles, so this only
// renders what it is handed.
export function RelatedArticles({ articles }) {
  if (!articles || articles.length === 0) return null;

  return (
    <section>
      <h2
        className="text-[24px] leading-tight"
        style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.02em" }}
      >
        Keep reading
      </h2>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {articles.map((a) => (
          <Link
            key={a.slug}
            href={`/blog/${a.slug}`}
            className="group block bg-[color:var(--paper-card)]"
            style={{ ...cardStyle, padding: "16px 18px" }}
          >
            {a.category && (
              <div
                className="uppercase"
                style={{ color: "var(--accent)", fontWeight: 500, letterSpacing: "0.08em", fontSize: 10.5 }}
              >
                {a.category}
              </div>
            )}
            <h3
              className="mt-2 text-[15px] leading-[1.35] text-[color:var(--ink-graphite)] group-hover:text-[color:var(--accent)]"
              style={{ fontWeight: 400, transition: "color 180ms ease-out" }}
            >
              {a.title}
            </h3>
            <div className="mt-2.5 text-[12px]" style={{ color: "var(--sage)" }}>
              {formatArticleDate(a.publishedAt)}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
