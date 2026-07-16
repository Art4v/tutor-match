"use client";
import { useState } from "react";
import { SectionReveal } from "@/components/anim/SectionReveal";
import { StaggerChildren, RevealItem } from "@/components/anim/CardReveal";
import { MessageTutorButton } from "./MessageTutorButton";

export function RateCard({ tutor, showMessage = true }) {
  const [pkg, setPkg] = useState(0);
  const packages = tutor.packages ?? [];
  const rateLine = "Online or in person · flexible scheduling";

  return (
    <SectionReveal hover className="paper-page bg-[color:var(--paper-card)]" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)", padding: 22 }}>
      <StaggerChildren delay={0.3} step={0.12}>
        <RevealItem>
          <div className="flex items-baseline gap-1">
            <span className="text-[34px] font-semibold text-slate-900 tabular-nums tracking-tight">
              ${tutor.rate}
            </span>
            <span className="text-[14px] text-slate-400">/hour</span>
          </div>
        </RevealItem>

        <RevealItem>
          <div className="text-[12.5px] text-slate-500 mt-1">{rateLine}</div>
        </RevealItem>

        {packages.length > 0 && packages.map((p, i) => (
          <RevealItem key={i}>
            <div className={i === 0 ? "mt-5" : "mt-2"}>
              <button
                onClick={() => setPkg(i)}
                className="w-full flex items-center justify-between p-3 text-left transition-colors"
                style={{
                  border: `1px solid ${pkg === i ? "var(--accent)" : "var(--paper-line)"}`,
                  borderRadius: 10,
                  background: pkg === i ? "var(--accent-softer)" : "#fff",
                  color: pkg === i ? "var(--accent)" : "var(--ink)",
                  transition: "background-color 200ms ease-out, border-color 200ms ease-out, color 200ms ease-out",
                }}
              >
                <div>
                  <div className="text-[13.5px] font-medium">{p.label}</div>
                </div>
                <div className="text-[15px] font-semibold tabular-nums">${p.price}</div>
              </button>
            </div>
          </RevealItem>
        ))}

        {showMessage && (
          <RevealItem>
            <div className="mt-5">
              <MessageTutorButton tutor={tutor} />
            </div>
          </RevealItem>
        )}
      </StaggerChildren>
    </SectionReveal>
  );
}
