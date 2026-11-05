import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getMyArticles, formatArticleDate } from "@/lib/blog";
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

// Status is plain text in a status colour (DESIGN.md: no pills, no tinted
// badges); the label itself carries the meaning, the colour only reinforces it.
const STATUS_TONE = {
  draft: "text-muted",
  pending: "text-[color:var(--text-2)]",
  published: "text-success",
  removed: "text-error",
};

export default async function AuthorPage() {
  const { supabase, user } = await requireAuthor();
  const articles = await getMyArticles(supabase, user.id);

  return (
    <div className="bg-surface min-h-screen">
      <div className="max-w-[1128px] mx-auto px-4 lg:px-6 pt-8 sm:pt-12 pb-16">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-semibold text-[color:var(--text)]">
              Your articles
            </h1>
            <p className="mt-2 text-[14px] leading-5 text-[color:var(--text-2)]">
              Write in Markdown. Each <code>##</code> heading becomes a section and a contents
              entry.
            </p>
          </div>
          {/* Styled as the primary Button (components/ui.js), which renders a
              <button> and so cannot be a link itself. */}
          <Link
            href="/author/new"
            className="inline-flex items-center justify-center h-11 px-4 rounded border border-accent bg-accent text-white text-[14px] leading-5 font-semibold whitespace-nowrap hover:bg-accent-hover hover:border-accent-hover"
            style={{ transition: "background-color 120ms ease-out, border-color 120ms ease-out" }}
          >
            New article
          </Link>
        </div>

        {articles.length === 0 ? (
          <p className="mt-8 text-[14px] leading-5 text-[color:var(--text-2)]">
            You have not written anything yet.{" "}
            <Link href="/author/new" className="accent-link">
              Write your first article
            </Link>
          </p>
        ) : (
          <ul className="mt-8 border-t border-rule">
            {articles.map((a) => (
              <li key={a.id} className="border-b border-rule">
                <Link
                  href={`/author/${a.id}`}
                  className="group flex items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[12px] leading-4">
                      <span className={`shrink-0 font-semibold ${STATUS_TONE[a.status] || STATUS_TONE.draft}`}>
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                      {a.category && <span className="text-muted">{a.category}</span>}
                    </div>
                    <div className="mt-1 text-[16px] leading-6 font-semibold truncate text-[color:var(--text)] group-hover:text-[color:var(--accent)]"
                      style={{ transition: "color 120ms ease-out" }}
                    >
                      {a.title}
                    </div>
                    <div className="mt-1 text-[12px] leading-4 text-muted">
                      /blog/{a.slug}
                      {a.publishedAt ? ` \u00b7 ${formatArticleDate(a.publishedAt)}` : ""}
                    </div>
                  </div>
                  <Icon name="chevron-right" size={16} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
