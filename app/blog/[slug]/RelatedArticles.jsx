import Link from "next/link";
import { formatArticleDate } from "@/lib/blog";

// "Keep reading" block at the foot of an article. Selection (same category
// first, then newest) lives in lib/blog.js getRelatedArticles, so this only
// renders what it is handed.
export function RelatedArticles({ articles }) {
  if (!articles || articles.length === 0) return null;

  // Rows divided by rules, not a grid of cards (DESIGN.md: lists are rows).
  return (
    <section className="border-t border-rule pt-8">
      <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">Keep reading</h2>

      <ul className="mt-4 border-t border-rule">
        {articles.map((a) => (
          <li key={a.slug} className="border-b border-rule">
            <Link href={`/blog/${a.slug}`} className="group block py-3">
              <span
                className="block text-[16px] leading-6 font-semibold text-[color:var(--text)] group-hover:text-[color:var(--accent)]"
                style={{ transition: "color 120ms ease-out" }}
              >
                {a.title}
              </span>
              <span className="mt-1 block text-[12px] leading-4 text-muted">
                {a.category ? `${a.category} \u00b7 ` : ""}
                {formatArticleDate(a.publishedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
