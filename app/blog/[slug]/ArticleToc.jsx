import { cardStyle } from "@/app/tutor/[slug]/ProfileCards";

// Chapter list for the article, rendered by the page into a sticky left rail on
// large screens and stacked above the body on small ones. Plain in-page anchors,
// so this stays a server component: the sections carry matching ids and
// `scroll-mt` clears the fixed nav. There is deliberately no scroll-spy
// highlighting of the current section, which would need a client boundary on an
// otherwise fully static route.
//
// Sizing is tuned for the ~200px of content the rail leaves: headings wrap to
// two or three lines there, so the type is a step down from body copy.
export function ArticleToc({ sections }) {
  if (!sections || sections.length < 2) return null;

  return (
    <nav
      aria-label="In this blog"
      className="bg-[color:var(--paper-card)]"
      style={{ ...cardStyle, padding: "18px 20px" }}
    >
      <h2 className="text-[14px] font-medium" style={{ color: "var(--ink-graphite)" }}>
        In this blog
      </h2>
      <ol className="mt-3 space-y-2.5">
        {sections.map((s, i) => (
          <li key={s.id} className="flex gap-2.5 text-[13.5px] leading-[1.45]">
            <span className="shrink-0 tabular-nums" style={{ color: "var(--sage)" }}>
              {i + 1}.
            </span>
            <a href={`#${s.id}`} className="accent-link">
              {s.heading}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
