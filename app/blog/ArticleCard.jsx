import Link from "next/link";
import { formatArticleDate } from "@/lib/blog";

// One entry in the /blog list. The whole card is a single link. The only hover
// feedback is the title's colour (DESIGN.md: no hover transforms, no sliding
// underline, no nudging arrow), done with CSS group-hover, so no client boundary.
//
// The art block is the article's cover photo from the blog-images bucket
// (0061). An article without one renders a neutral block in the same footprint
// rather than a placeholder image, so the grid rhythm never shifts: same
// aspect ratio, same border, same radius in both branches.
export function ArticleCard({ article }) {
  const { slug, title, excerpt, category, publishedAt, author, coverUrl, coverAlt } = article;

  return (
    <Link href={`/blog/${slug}`} className="group block">
      <div className="relative overflow-hidden w-full aspect-[2/1] rounded border border-rule bg-surface-2">
        {coverUrl && (
          // alt="" when the article gives no alt text: the cover is decorative
          // here, and the card's heading right below it already names the
          // article, so announcing the image twice is worse than not at all.
          <img
            src={coverUrl}
            alt={coverAlt || ""}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-2 text-[12px] leading-4 text-muted">
        {author?.name && <span className="text-[color:var(--text-2)]">{author.name}</span>}
        {author?.name && category && <span aria-hidden="true">&middot;</span>}
        {category && <span>{category}</span>}
        {(author?.name || category) && <span aria-hidden="true">&middot;</span>}
        <span className="whitespace-nowrap">{formatArticleDate(publishedAt)}</span>
      </div>

      <h2
        className="mt-2 text-[20px] leading-7 font-semibold text-[color:var(--text)] group-hover:text-[color:var(--accent)]"
        style={{ transition: "color 120ms ease-out" }}
      >
        {title}
      </h2>

      <p className="mt-2 text-[14px] leading-5 text-[color:var(--text-2)] line-clamp-3">{excerpt}</p>
    </Link>
  );
}
