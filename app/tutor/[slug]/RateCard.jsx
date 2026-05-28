"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { SectionReveal } from "@/components/anim/SectionReveal";
import { RevealChildren } from "@/components/anim/CardReveal";
import { TypewriterOnView } from "@/components/anim/TypewriterOnView";

export function RateCard({ tutor }) {
  const [pkg, setPkg] = useState(0);
  const packages = tutor.packages ?? [];
  const rateLine = "Online or in person · flexible scheduling";

  return (
    <SectionReveal hover className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 22 }}>
      <div className="flex items-baseline gap-1">
        <span className="text-[34px] font-semibold text-slate-900 tabular-nums tracking-tight">
          <TypewriterOnView text={`$${tutor.rate}`} speed={40} delay={350} cursor={false} />
        </span>
        <span className="text-[14px] text-slate-400">/hour</span>
      </div>
      <div className="text-[12.5px] text-slate-500 mt-1">
        <TypewriterOnView text={rateLine} speed={10} cursor={false} delay={700} />
      </div>

      {packages.length > 0 && (
        <RevealChildren delay={1.0} className="mt-5 space-y-2">
          {packages.map((p, i) => (
            <button
              key={i}
              onClick={() => setPkg(i)}
              className="w-full flex items-center justify-between p-3 text-left transition-colors"
              style={{
                border: `1px solid ${pkg === i ? "var(--accent)" : "#E5E7EB"}`,
                borderRadius: 10,
                background: pkg === i ? "var(--accent-softer)" : "#fff",
                color: pkg === i ? "var(--accent)" : "#0F172A",
                transition: "background-color 200ms ease-out, border-color 200ms ease-out, color 200ms ease-out",
              }}
            >
              <div>
                <div className="text-[13.5px] font-medium">{p.label}</div>
              </div>
              <div className="text-[15px] font-semibold tabular-nums">${p.price}</div>
            </button>
          ))}
        </RevealChildren>
      )}

      <RevealChildren delay={1.2} className="mt-5 space-y-1.5">
        <Button variant="primary" size="lg" icon="calendar" full disabled>Request a lesson</Button>
        <div className="text-center text-[12px] text-slate-400">(coming soon)</div>
      </RevealChildren>
    </SectionReveal>
  );
}
