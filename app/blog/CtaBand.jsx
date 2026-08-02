import Link from "next/link";
import { Button } from "@/components/ui";
import { Icon } from "@/components/Icon";

// Closing call to action for the blog surfaces. It echoes HomeCta's gradient
// band and decorative tree, but is a SERVER component: HomeCta is client-side
// only because its button destination branches on whether you are signed in,
// and this one always points at /browse.
export function CtaBand({ title, body, buttonLabel = "Browse tutors", href = "/browse", compact = false }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #E7F2F1 0%, #F5FAFA 100%)",
        border: "1px solid var(--paper-line)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
        <div
          className="absolute"
          style={{ bottom: -26, right: compact ? -16 : 24, color: "var(--accent)", opacity: 0.08 }}
        >
          <Icon name="tree" size={compact ? 180 : 220} strokeWidth={1.1} />
        </div>
      </div>

      <div
        className={`relative flex flex-col items-center text-center ${compact ? "px-6 py-10" : "px-6 py-14 sm:px-10"}`}
      >
        <h2
          style={{
            fontSize: compact ? "clamp(24px, 3.2vw, 30px)" : "clamp(28px, 4vw, 38px)",
            fontWeight: 300,
            lineHeight: 1.15,
            letterSpacing: "-0.025em",
            color: "var(--ink-graphite)",
          }}
        >
          {title}
        </h2>
        {body && (
          <p className="text-[14.5px] sm:text-[15px] text-[color:var(--ink-muted)] mt-4 leading-[1.6] max-w-[460px]">
            {body}
          </p>
        )}
        <div className="mt-7">
          <Link href={href}>
            <Button variant="primary" size="lg" iconRight="arrow-right">
              {buttonLabel}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
