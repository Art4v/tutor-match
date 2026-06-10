import { Icon } from "@/components/Icon";

/**
 * Cream "desk" backdrop — a faint paper-grain wash plus a few small stationery
 * motifs (pencil, ruler, paperclip, …) that gently sway, like odds and ends
 * scattered on a desk. Purely decorative: `aria-hidden`, `pointer-events-none`,
 * and absolutely filling its (relatively-positioned) parent.
 *
 * No client hooks — the float is the CSS-only `.leaf-sway`, so this renders fine
 * inside server components (the tutor page) as well as client ones.
 *
 * Mirrors the home hero's botanical-sprig pattern (HomeHero.jsx), swapping the
 * leaves for stationery. Motifs sit toward the margins and at low opacity so
 * they stay behind the content without hurting legibility. Vertical positions
 * are percentages, so they spread across both the short featured section and
 * the tall tutor page.
 */
const MOTIFS = [
  { name: "pencil",     top: "8%",  left: "4%",   size: 64, opacity: 0.16, dur: "7s",   delay: "0s" },
  { name: "ruler",      top: "17%", right: "5%",  size: 90, opacity: 0.12, dur: "8s",   delay: "-2s" },
  { name: "eraser",     top: "31%", right: "9%",  size: 48, opacity: 0.16, dur: "7.5s", delay: "-3s" },
  { name: "paperclip",  top: "40%", left: "6%",   size: 52, opacity: 0.15, dur: "6.5s", delay: "-1s" },
  { name: "set-square", top: "58%", right: "5%",  size: 86, opacity: 0.11, dur: "8.5s", delay: "-1.5s" },
  { name: "scissors",   top: "66%", left: "5%",   size: 56, opacity: 0.14, dur: "7s",   delay: "-4s" },
  { name: "notebook",   top: "84%", left: "8%",   size: 60, opacity: 0.13, dur: "8s",   delay: "-2.5s" },
  { name: "pencil",     top: "90%", right: "8%",  size: 58, opacity: 0.14, dur: "6.8s", delay: "-0.5s" },
];

export function DeskBackdrop({ className = "" }) {
  return (
    <div aria-hidden="true" className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {/* Faint paper grain for a sketched-desk feel. */}
      <div className="absolute inset-0 paper-grain opacity-[0.5]" />

      {/* Scattered stationery motifs, gently swaying. */}
      {MOTIFS.map((m, i) => (
        <div
          key={i}
          className="absolute leaf-sway hidden sm:block"
          style={{
            top: m.top,
            left: m.left,
            right: m.right,
            color: "var(--sage)",
            opacity: m.opacity,
            animationDuration: m.dur,
            animationDelay: m.delay,
          }}
        >
          <Icon name={m.name} size={m.size} strokeWidth={1.3} />
        </div>
      ))}
    </div>
  );
}

export default DeskBackdrop;
