// Chapter list for the article, rendered by the page into a sticky left rail on
// large screens and stacked above the body on small ones. Plain in-page anchors,
// so this stays a server component: the sections carry matching ids and
// `scroll-mt` clears the fixed nav. There is deliberately no scroll-spy
// highlighting of the current section, which would need a client boundary on an
// otherwise fully static route.
//
// Sizing is tuned for the ~200px of content the rail leaves: headings wrap to
// two or three lines there, so the type is the 14px UI size, a step down from body copy.
export function ArticleToc({ sections }) {
  if (!sections || sections.length < 2) return null;

  // No box (DESIGN.md: prefer no box): a heading and a plain list, with a
  // rule on the left on wide screens to set it apart from the body.
  return (
    <nav aria-label="In this blog" className="lg:border-l lg:border-rule lg:pl-6">
      <h2 className="text-[14px] leading-5 font-semibold text-[color:var(--text)]">In this blog</h2>
      <ol className="mt-2">
        {sections.map((s, i) => (
          <li key={s.id} className="flex gap-2 text-[14px] leading-5">
            <span className="shrink-0 tabular-nums py-1 text-muted">{i + 1}.</span>
            <a href={`#${s.id}`} className="accent-link block min-h-6 py-1">
              {s.heading}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
