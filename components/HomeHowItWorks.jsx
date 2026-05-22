"use client";
import { useState } from "react";

const STEPS = [
  {
    n: "01",
    t: "Browse verified profiles",
    b: "Every tutor's ATAR, marks and identity are independently checked. Filter by subject, year, location and rate.",
  },
  {
    n: "02",
    t: "Pick a tutor that fits",
    b: "Read bios, compare rates, and check availability. Save the ones you're considering so you can come back later.",
  },
  {
    n: "03",
    t: "Lessons, in-person or online",
    b: "Meet in person or over video. Set a schedule that fits around school and stay in touch with your tutor between sessions.",
  },
];

export function HomeHowItWorks() {
  return (
    <section className="max-w-[1200px] mx-auto px-6 mt-16">
      <h2 className="text-[24px] font-semibold text-slate-900 tracking-tight mb-10">How tutormatch works</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {STEPS.map((s) => (
          <HowItWorksCard key={s.n} {...s} />
        ))}
      </div>
    </section>
  );
}

function HowItWorksCard({ n, t, b }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="p-6 block"
      style={{
        border: `1px solid ${hover ? "#D1D5DB" : "#E5E7EB"}`,
        borderRadius: 14,
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 180ms ease-out, border-color 180ms ease-out",
      }}
    >
      <div className="text-[12.5px] font-semibold tabular-nums text-slate-400 mb-3 tracking-wider">{n}</div>
      <div className="text-[17px] font-semibold text-slate-900 mb-2">{t}</div>
      <p className="text-[14px] text-slate-600 leading-[1.55]">{b}</p>
    </div>
  );
}
