import Link from "next/link";

/**
 * A home "Browse by …" link list (DESIGN.md §6 "Link lists"): plain underlined
 * text links with the tutor count in muted text, up to three columns wide, one
 * on phones. Server component; renders nothing when there are no items, so a
 * list never shows an empty heading.
 *
 * items: [{ label, path, count }]
 */
export function BrowseLinks({ title, items, more = null }) {
  if (!items?.length) return null;
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-[20px] leading-7 font-semibold text-[color:var(--text)]">{title}</h2>
      <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
        {items.map((it) => (
          <li key={it.path} className="min-h-6 flex items-baseline gap-2 text-[14px] leading-5">
            <Link
              href={it.path}
              className="inline-flex items-center min-h-6 text-accent underline underline-offset-2 hover:text-[color:var(--accent-hover)]"
            >
              {it.label}
            </Link>
            <span className="text-[12px] leading-4 text-muted tabular-nums">{it.count}</span>
          </li>
        ))}
      </ul>
      {more && (
        <p className="mt-3 text-[14px] leading-5">
          <Link
            href={more.path}
            className="inline-flex items-center min-h-6 text-accent underline underline-offset-2 hover:text-[color:var(--accent-hover)]"
          >
            {more.label}
          </Link>
        </p>
      )}
    </section>
  );
}
