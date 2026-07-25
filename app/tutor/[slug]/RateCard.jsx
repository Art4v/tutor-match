"use client";
import { useState } from "react";
import { MessageTutorButton } from "./MessageTutorButton";
import { cardStyle } from "./ProfileCards";

export function RateCard({ tutor, showMessage = true }) {
  const [pkg, setPkg] = useState(0);
  const packages = tutor.packages ?? [];
  const rateLine = "Online or in person · flexible scheduling";

  return (
    <div
      className="bg-[color:var(--paper-card)]"
      style={{ ...cardStyle, padding: "18px 20px" }}
    >
      <div className="flex items-baseline gap-1">
        <span className="text-[40px] font-light tabular-nums" style={{ color: "var(--ink-graphite-deep)", letterSpacing: "-0.02em" }}>
          ${tutor.rate}
        </span>
        <span className="text-[16px]" style={{ color: "var(--sage)" }}>/hour</span>
      </div>

      <div className="text-[13.5px] mt-1" style={{ color: "var(--sage)" }}>{rateLine}</div>

      {packages.length > 0 && (
        <div className="flex flex-col gap-[10px] mt-5">
          {packages.map((p, i) => (
            <button
              key={i}
              onClick={() => setPkg(i)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left"
              style={{
                border: `1px solid ${pkg === i ? "var(--accent)" : "var(--accent-line)"}`,
                borderRadius: 11,
                background: pkg === i ? "var(--accent-soft)" : "var(--accent-softer)",
                color: pkg === i ? "var(--accent)" : "var(--ink-graphite)",
                transition: "background-color 200ms ease-out, border-color 200ms ease-out, color 200ms ease-out",
              }}
            >
              <span className="text-[14px] font-medium">{p.label}</span>
              <span className="text-[14px] font-medium tabular-nums">${p.price}</span>
            </button>
          ))}
        </div>
      )}

      {showMessage && (
        <div className="mt-5">
          <MessageTutorButton tutor={tutor} />
        </div>
      )}
    </div>
  );
}
