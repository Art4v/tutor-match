import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getMyArticles, formatArticleDate } from "@/lib/blog";
import { cardStyle } from "@/app/tutor/[slug]/ProfileCards";
import { requireAuthor } from "./guard";

export const metadata = { title: "Your articles" };

// Draft and published are the only two an author drives; pending and removed
// exist in the schema (0061) and are shown here so a removed article does not
// simply vanish from its author's own list without explanation.
const STATUS_LABEL = {
  draft: "Draft",
  pending: "In review",
  published: "Published",
  removed: "Removed",
};

const STATUS_TONE = {
  draft: { bg: "var(--desk)", color: "var(--ink-muted)" },
  pending: { bg: "var(--accent-softer)", color: "var(--accent)" },
  published: { bg: "var(--accent-softer)", color: "var(--accent)" },
  removed: { bg: "#FBEAEA", color: "#9B2C2C" },
};

export default async function AuthorPage() {
  const { supabase, user } = await requireAuthor();
  const articles = await getMyArticles(supabase, user.id);

  return (
    <div className="bg-[color:var(--paper-card)] min-h-screen">
      <div className="max-w-[880px] mx-auto px-6 pt-16 pb-20">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1
              className="text-[32px] sm:text-[38px] leading-[1.15]"
              style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}
            >
              Your articles
            </h1>
            <p className="mt-3 text-[15px] leading-[1.6]" style={{ color: "var(--ink-muted)" }}>
              Write in Markdown. Each <code>##</code> heading becomes a section and a contents
              entry.
            </p>
          </div>
          <Link href="/author/new">
            <span
              className="inline-flex items-center gap-2 font-medium"
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "1px solid var(--accent)",
                padding: "8px 16px",
                fontSize: 14,
                height: 38,
                borderRadius: 9,
              }}
            >
              <Icon name="plus" size={16} />
              New article
            </span>
          </Link>
        </div>

        {articles.length === 0 ? (
          <p className="mt-14 text-[15px]" style={{ color: "var(--ink-muted)" }}>
            You have not written anything yet. Start with your first article.
          </p>
        ) : (
          <ul className="mt-10 space-y-3">
            {articles.map((a) => {
              const tone = STATUS_TONE[a.status] || STATUS_TONE.draft;
              return (
                <li key={a.id}>
                  <Link
                    href={`/author/${a.id}`}
                    className="group block px-5 py-4"
                    style={cardStyle}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="shrink-0 uppercase"
                            style={{
                              background: tone.bg,
                              color: tone.color,
                              fontSize: 10.5,
                              fontWeight: 500,
                              letterSpacing: "0.08em",
                              padding: "3px 8px",
                              borderRadius: 999,
                            }}
                          >
                            {STATUS_LABEL[a.status] || a.status}
                          </span>
                          {a.category && (
                            <span className="text-[12px]" style={{ color: "var(--sage)" }}>
                              {a.category}
                            </span>
                          )}
                        </div>
                        <div
                          className="mt-2 text-[16px] truncate group-hover:text-[color:var(--accent)]"
                          style={{ color: "var(--ink-graphite)", transition: "color 180ms ease-out" }}
                        >
                          {a.title}
                        </div>
                        <div className="mt-1 text-[12.5px]" style={{ color: "var(--sage)" }}>
                          /blog/{a.slug}
                          {a.publishedAt ? ` · ${formatArticleDate(a.publishedAt)}` : ""}
                        </div>
                      </div>
                      <Icon
                        name="chevron-right"
                        size={16}
                        className="shrink-0 transition-transform group-hover:translate-x-0.5"
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
