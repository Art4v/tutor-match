import Link from "next/link";
import { InlineMarkdown } from "@/components/RichText";
import { Avatar } from "@/components/ui";

// The byline renders the joined tutor behind articles.author_id (0061), so the
// name, photo and tagline follow the profile instead of being frozen into the
// article. `linkHref` is passed only when that profile is public, so a deleted
// account, a disabled one or a profile set to private downgrades the byline to
// plain text (or to nothing) instead of breaking the page.
//
// The photo is the shared components/ui.js `Avatar` (circle, initials from the
// display name as the fallback), the same as every other person on the site.
export function ArticleByline({ author, linkHref = null }) {
  if (!author?.name) return null;

  const inner = (
    <>
      <Avatar tutor={{ avatarImg: author.avatar || null, name: author.name }} size={40} />
      <span className="min-w-0">
        <span
          className="block text-[14px] leading-5 font-semibold text-[color:var(--text)] group-hover:text-[color:var(--accent)]"
          style={{ transition: "color 120ms ease-out" }}
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
            under the name would out-weigh the name itself; the
            descendant selector below outranks that single class and keeps
            emphasis one step darker than the line, not black. */}
        {author.roleLine && (
          <span
            className="text-[14px] leading-5 line-clamp-2 text-[color:var(--text-2)] [&_strong]:text-[color:var(--text)]"
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
