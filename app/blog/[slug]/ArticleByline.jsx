import Link from "next/link";
import { InlineMarkdown } from "@/components/RichText";

// The byline renders the joined tutor behind articles.author_id (0061), so the
// name, photo and tagline follow the profile instead of being frozen into the
// article. `linkHref` is passed only when that profile is public, so a deleted
// account, a disabled one or a profile set to private downgrades the byline to
// plain text (or to nothing) instead of breaking the page.
//
// The initials chip is local rather than components/ui.js `Avatar`, whose
// no-image fallback is a graduation cap; a byline wants the person's initials.
export function ArticleByline({ author, linkHref = null }) {
  if (!author?.name) return null;

  const inner = (
    <>
      <span
        className="shrink-0 inline-flex items-center justify-center overflow-hidden"
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          backgroundColor: author.avatarBg || "var(--accent-softer)",
          backgroundImage: author.avatar ? `url(${author.avatar})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          color: "var(--ink-graphite)",
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: "0.01em",
        }}
        aria-hidden="true"
      >
        {!author.avatar && author.initials}
      </span>
      <span className="min-w-0">
        <span
          className="block text-[14px] font-medium text-[color:var(--ink)] group-hover:text-[color:var(--accent)]"
          style={{ transition: "color 180ms ease-out" }}
        >
          {author.name}
        </span>
        {/* The tutor's own tagline, which is a sentence rather than the short
            "HSC tutor" label this used to hold. Clamped so a long one wraps to
            two lines instead of stretching the 40px avatar row.

            It carries the same **bold** / *italic* subset every other surface
            gives that field (see ProfileHeaderText), so it goes through
            InlineMarkdown rather than being printed raw, which showed the
            asterisks. InlineMarkdown's <strong> hardcodes text-slate-900, which
            at 12.5px under the name would out-weigh the name itself; the
            descendant selector below outranks that single class and keeps
            emphasis one step darker than the line, not black. */}
        {author.roleLine && (
          <span
            className="text-[12.5px] mt-0.5 line-clamp-2 [&_strong]:text-[color:var(--ink-muted)]"
            style={{ color: "var(--sage)" }}
          >
            <InlineMarkdown text={author.roleLine} />
          </span>
        )}
      </span>
    </>
  );

  if (linkHref) {
    return (
      <Link href={linkHref} className="group inline-flex items-center gap-3">
        {inner}
      </Link>
    );
  }
  return <div className="inline-flex items-center gap-3">{inner}</div>;
}
