import Link from "next/link";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";

// Closing call to action for the blog surfaces, built to read as the same
// component family as the home page's HomeCta: identical gradient, the same
// bottom-right tree at 0.08 opacity, a centred eyebrow / light heading / body
// stack, and a two-button row of primary + outline.
//
// It is a SERVER component, unlike HomeCta, which is client-side only because
// its first button branches on whether you are signed in. Here both
// destinations are static, so nothing needs the browser.
//
// The markup below is deliberately HomeCta's, line for line: same padding
// rhythm, same `.font-hand` eyebrow at 26px, same clamp heading, same body
// sizes, same button row. Only the copy and the destinations differ, so the two
// bands render at the same height. If you change the spacing or type here,
// change components/HomeCta.jsx to match, and vice versa.
//
// Full-bleed by design: both callers render it OUTSIDE their max-width
// container so it closes the page as its own slice, exactly like HomeCta.
export function CtaBand({ eyebrow, title, body, primary, secondary }) {
  return (
    <section
      className="relative overflow-hidden flex items-center"
      style={{ background: "linear-gradient(160deg, #E7F2F1 0%, #F5FAFA 100%)" }}
    >
      {/* Decorative tree, held inside a centred max-width track so it keeps its
          distance from the content instead of drifting to the viewport edge on
          wide screens. The trunk stops 3/24 of the icon's size above its box, so
          the negative bottom offset lands it on the section edge. */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
        <div className="relative h-full max-w-[1200px] mx-auto px-6">
          <div className="absolute" style={{ bottom: -38, right: 56, color: "var(--accent)", opacity: 0.08 }}>
            <Icon name="tree" size={300} strokeWidth={1.1} />
          </div>
        </div>
      </div>

      <div className="relative max-w-[1200px] w-full mx-auto px-6 pt-4 pb-16">
        <div className="px-8 py-14 md:px-16 md:py-[76px]">
          <div className="relative flex flex-col items-center text-center gap-9">
            <div className="max-w-[680px] flex flex-col items-center">
              {eyebrow && (
                <div className="font-hand text-[26px] mb-2" style={{ color: "var(--accent)", fontWeight: 400 }}>
                  {eyebrow}
                </div>
              )}

              <h2
                style={{
                  fontSize: "clamp(32px, 4.5vw, 54px)",
                  fontWeight: 300,
                  lineHeight: 1.1,
                  letterSpacing: "-0.025em",
                  color: "var(--ink-graphite)",
                }}
              >
                {title}
              </h2>

              {body && (
                <p className="text-[13px] sm:text-[15px] md:text-[16px] text-[color:var(--ink-muted)] mt-5 sm:mt-7 leading-[1.6] max-w-[560px]">
                  {body}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-5 w-full max-w-[480px] justify-center">
              <div className="flex-1">
                {/* block, so the `full` button fills the flex cell rather than
                    the link's inline width. */}
                <Link href={primary.href} className="block">
                  <Button variant="primary" size="lg" full>
                    {primary.label}
                  </Button>
                </Link>
              </div>
              {secondary && (
                <div className="flex-1">
                  <Link href={secondary.href} className="block">
                    <Button variant="outline" size="lg" full>
                      {secondary.label}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
