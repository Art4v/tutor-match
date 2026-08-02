import Link from "next/link";
import { Icon } from "@/components/Icon";
import { formatArticleDate } from "@/lib/blog";

// One entry in the /blog list. The whole card is a single link, so the "Read"
// affordance is a span rather than a nested anchor, and every hover effect is
// CSS group-hover — no state, no client boundary.
//
// There are no article photographs: the art block is a per-article gradient
// (meta.accent) over a faint oversized icon, which keeps the index visually
// varied without adding binary assets to the repo.
export function ArticleCard({ article }) {
  const { slug, title, excerpt, category, publishedAt, author, accent } = article;

  return (
    <Link href={`/blog/${slug}`} className="group block">
      <div
        className="relative overflow-hidden w-full aspect-[2/1]"
        style={{
          background: `linear-gradient(${accent?.angle ?? 150}deg, ${accent?.from ?? "#E7F2F1"}, ${accent?.to ?? "#CFE5E3"})`,
          border: "1px solid var(--paper-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <div
          aria-hidden="true"
          className="absolute pointer-events-none select-none"
          style={{ right: -18, bottom: -34, color: "var(--accent)", opacity: 0.1 }}
        >
          <Icon name="notebook" size={210} strokeWidth={1} />
        </div>
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-4">
        <div className="min-w-0 flex items-baseline gap-2.5 text-[12.5px]">
          <span className="font-medium truncate" style={{ color: "var(--ink-muted)" }}>
            {author?.name}
          </span>
          {category && (
            <span
              className="uppercase whitespace-nowrap"
              style={{ color: "var(--accent)", fontWeight: 500, letterSpacing: "0.08em", fontSize: 11 }}
            >
              {category}
            </span>
          )}
        </div>
        <span className="text-[13px] whitespace-nowrap" style={{ color: "var(--sage)" }}>
          {formatArticleDate(publishedAt)}
        </span>
      </div>

      <h2
        className="mt-2.5 text-[21px] sm:text-[23px] leading-[1.25] text-[color:var(--ink-graphite)] group-hover:text-[color:var(--accent)]"
        style={{ fontWeight: 300, letterSpacing: "-0.02em", transition: "color 200ms ease-out" }}
      >
        {title}
      </h2>

      <p className="mt-3 text-[14.5px] text-slate-700 leading-[1.65] line-clamp-3">{excerpt}</p>

      {/* Same control as FeaturedTutors' "Browse all N verified tutors": trailing
          arrow that nudges right and an underline that wipes in from the left.
          It hangs off the CARD's `group`, not its own, so the animation runs when
          you hover anywhere on the card, which is the whole click target.
          `relative` anchors the underline; the right inset clears the arrow
          (14px icon + gap-2) so the rule spans the label only. */}
      <span
        className="mt-4 relative inline-flex items-center gap-2 text-[13.5px] font-medium"
        style={{ color: "var(--accent)" }}
      >
        Read the guide
        <Icon
          name="arrow-right"
          size={14}
          className="shrink-0 transition-transform group-hover:translate-x-0.5"
        />
        <span
          aria-hidden="true"
          className="absolute left-0 right-[24px] -bottom-0.5 h-px origin-left scale-x-0 group-hover:scale-x-100"
          style={{ background: "var(--accent)", transition: "transform 280ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </span>
    </Link>
  );
}
