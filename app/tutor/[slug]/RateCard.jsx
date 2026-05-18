"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";

export function RateCard({ tutor }) {
  const [pkg, setPkg] = useState(0);
  const packages = tutor.packages ?? [];

  return (
    <div className="bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 16, padding: 22 }}>
      <div className="flex items-baseline gap-1">
        <span className="text-[34px] font-semibold text-slate-900 tabular-nums tracking-tight">${tutor.rate}</span>
        <span className="text-[14px] text-slate-400">/hour</span>
      </div>
      <div className="text-[12.5px] text-slate-500 mt-1">60-minute lesson · first 20 min free</div>

      {packages.length > 0 && (
        <div className="mt-5 space-y-2">
          {packages.map((p, i) => (
            <button
              key={i}
              onClick={() => setPkg(i)}
              className="w-full flex items-center justify-between p-3 text-left transition-colors"
              style={{
                border: `1px solid ${pkg === i ? "#0F172A" : "#E5E7EB"}`,
                borderRadius: 10,
                background: pkg === i ? "#F8FAFC" : "#fff",
              }}
            >
              <div>
                <div className="text-[13.5px] font-medium text-slate-900">{p.label}</div>
                <div className="text-[11.5px] text-slate-500">
                  {p.duration}
                  {p.save ? ` · ${p.save}` : ""}
                </div>
              </div>
              <div className="text-[15px] font-semibold tabular-nums text-slate-900">${p.price}</div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-2">
        <Button variant="primary" size="lg" icon="calendar" full>Request a lesson</Button>
      </div>

      <div className="mt-4 pt-4 flex items-center gap-2 text-[12px] text-slate-500" style={{ borderTop: "1px solid #F1F5F9" }}>
        <Icon name="shield" size={13} />
        Payment held by tutormatch until lesson is confirmed
      </div>
    </div>
  );
}
