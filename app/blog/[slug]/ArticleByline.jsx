import Link from "next/link";

// The byline always renders from the article's own metadata, never from the
// database. `linkHref` is passed only when the author's tutorSlug resolved to a
// live public profile, so an empty database, a deleted account or a profile set
// to private downgrades the byline to plain text instead of breaking the page.
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
        {author.roleLine && (
          <span className="block text-[12.5px] mt-0.5" style={{ color: "var(--sage)" }}>
            {author.roleLine}
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
