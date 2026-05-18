"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function HomeCta() {
  const router = useRouter();
  return (
    <section className="max-w-[1200px] mx-auto px-6 mt-16">
      <div
        className="p-10 md:p-14 grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
        style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: 20 }}
      >
        <div>
          <div className="text-[12.5px] font-medium text-slate-500 uppercase tracking-wider mb-3">For graduates</div>
          <h3 className="text-[32px] font-semibold text-slate-900 tracking-tight leading-[1.15]">
            You did the work. Now teach it.
          </h3>
          <p className="text-[15px] text-slate-600 mt-4 leading-[1.55] max-w-[460px]">
            If your ATAR is above 95, tutormatch is the cleanest way to build a private tutoring practice. Set your own rate, choose your own students, keep 92% of every booking.
          </p>
          <div className="flex gap-3 mt-7">
            <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => router.push("/signup")}>Become a tutor</Button>
            <Button variant="outline" size="lg" onClick={() => router.push("/browse")}>Browse tutors</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { n: "92%", l: "average payout rate" },
            { n: "$74", l: "median hourly rate" },
            { n: "11", l: "min. avg. response time" },
            { n: "48 hrs", l: "to verify your profile" },
          ].map((s) => (
            <div key={s.l} className="p-5 bg-white" style={{ border: "1px solid #E5E7EB", borderRadius: 12 }}>
              <div className="text-[28px] font-semibold text-slate-900 tabular-nums tracking-tight">{s.n}</div>
              <div className="text-[12.5px] text-slate-500 mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
