"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function HomeCta() {
  const router = useRouter();
  return (
    <section className="max-w-[1200px] mx-auto px-6 mt-16">
      <div
        className="p-10 md:p-14 flex flex-col md:flex-row md:items-center md:justify-between gap-8"
        style={{ background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: 20 }}
      >
        <div className="max-w-[560px]">
          <div className="text-[12.5px] font-medium text-slate-500 uppercase tracking-wider mb-3">For tutors.</div>
          <h3 className="text-[32px] font-semibold text-slate-900 tracking-tight leading-[1.15]">
            You did the work. Now teach it.
          </h3>
          <p className="text-[15px] text-slate-600 mt-4 leading-[1.55]">
            Tutormatch is the cleanest way to build a private tutoring practice. Connect with clients in a way you never have before, all completely for free. No fees, no commissions, no catch.
          </p>
        </div>
        <div className="flex flex-col gap-3 shrink-0">
          <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => router.push("/signup")}>Become a tutor</Button>
          <Button variant="outline" size="lg" onClick={() => router.push("/browse")}>Browse tutors</Button>
        </div>
      </div>
    </section>
  );
}
