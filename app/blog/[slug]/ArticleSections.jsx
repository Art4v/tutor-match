import { ArticleBody } from "./ArticleBody";

// ============================================================================
// The article's sections, rendered identically by the public page and by the
// editor's preview.
//
// This is extracted rather than duplicated BECAUSE it drifted once already, in
// two ways that both shipped bugs the author could not see:
//
//   1. The preview rendered the <h2> conditionally while the page rendered it
//      unconditionally. Text before the first `##` becomes a section with
//      heading: null, so an article that looked right in preview published with
//      an EMPTY <h2> carrying its full 24px bottom margin, a phantom gap.
//   2. The preview omitted `id` and `scroll-mt-24`, so ArticleToc's anchors
//      could not be checked before publishing, which is the whole point of the
//      one-section-per-## model.
//
// Keep it free of hooks, handlers and any supabase client: it renders inside a
// server tree on /blog/[slug] and inside a client tree in ArticleEditor, the
// same constraint ArticleBody already satisfies.
// ============================================================================

export function ArticleSections({ sections }) {
  if (!Array.isArray(sections)) return null;

  return (
    <div className="text-[15px] text-slate-700 leading-[1.7]">
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="mt-12 first:mt-0 scroll-mt-24">
          <h2
            className="text-[24px] font-light mb-4"
            style={{ color: "var(--ink-graphite-deep)", letterSpacing: "-0.015em" }}
          >
            {section.heading}
          </h2>
          <ArticleBody content={section.content} />
        </section>
      ))}
    </div>
  );
}
