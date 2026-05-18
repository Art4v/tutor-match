"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TUTORS } from "@/lib/data";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { TutorCard } from "@/components/TutorCard";
import { Footer } from "@/components/Footer";

export default function HomePage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const goBrowse = () => {
    const params = subject ? `?q=${encodeURIComponent(subject)}` : "";
    router.push(`/browse${params}`);
  };

  return (
    <div className="bg-white">
      <section className="max-w-[1200px] mx-auto px-6 pt-40 pb-16">
        <div className="max-w-[820px]">
          <h1 className="text-[56px] md:text-[64px] font-semibold text-slate-900 leading-[1.05] tracking-[-0.025em]">
            Find a tutor who's<br />
            <span className="text-slate-500">been where you're going.</span>
          </h1>
          <p className="text-[17px] text-slate-600 mt-6 leading-[1.55] max-w-[560px]">
            High school students across Australia are using tutormatch to work with the country's strongest recent graduates — verified ATARs, real reviews, no agency markup.
          </p>

          <div
            className="mt-10 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1.4fr_auto] items-stretch bg-white max-w-[860px]"
            style={{ border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden" }}
          >
            <SearchField icon="map-pin" label="Location" placeholder="Sydney, NSW" />
            <SearchField icon="graduation" label="Year" placeholder="Year 12" />
            <SearchField icon="search" label="Subject" placeholder="Mathematics Ext 2" value={subject} onChange={setSubject} />
            <div className="p-2 md:p-1.5 flex items-stretch">
              <Button variant="primary" size="lg" icon="search" onClick={goBrowse} full>Search</Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-8 text-[13.5px] text-slate-500">
            <Stat n="4,425" label="verified tutors" />
            <Stat n="12" label="curriculum tracks" />
            <Stat n="48,000+" label="lessons booked" />
            <Stat n="4.9 / 5.0" label="avg. rating" />
          </div>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 mt-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-[24px] font-semibold text-slate-900 tracking-tight">Featured tutors this week</h2>
            <p className="text-[14px] text-slate-500 mt-1">Hand-picked based on student outcomes and recent reviews</p>
          </div>
          <button onClick={() => router.push("/browse")} className="text-[13.5px] text-slate-700 hover:text-slate-900 hidden md:inline-flex items-center gap-1">
            See all 4,425 <Icon name="arrow-right" size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {TUTORS.slice(0, 9).map((t) => (
            <TutorCard key={t.id} tutor={t} />
          ))}
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 mt-16">
        <h2 className="text-[24px] font-semibold text-slate-900 tracking-tight mb-10">How tutormatch works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { n: "01", t: "Browse verified profiles", b: "Every tutor's ATAR, marks and identity are independently checked. Filter by subject, year, location and rate.", href: "/browse" },
            { n: "02", t: "Message before you book", b: "Discuss your goals and lesson schedule directly. Most tutors offer a free 20-minute intro call.", href: "/messages" },
            { n: "03", t: "Lessons, in-person or online", b: "Pay safely through tutormatch. We hold payment until 24 hours after the lesson — no agency markup.", href: "/#top" },
          ].map((s) => (
            <HowItWorksCard key={s.n} {...s} />
          ))}
        </div>
      </section>

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
              <Button variant="primary" size="lg" iconRight="arrow-right">Become a tutor</Button>
              <Button variant="outline" size="lg">Read the handbook</Button>
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

      <Footer />
    </div>
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

function SearchField({ icon, label, placeholder, value, onChange }) {
  return (
    <label className="flex items-center gap-3 px-4 py-3 cursor-text border-r last:border-r-0" style={{ borderColor: "#E5E7EB" }}>
      <Icon name={icon} size={16} className="text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</div>
        <input
          placeholder={placeholder}
          value={value || ""}
          onChange={(e) => onChange && onChange(e.target.value)}
          className="w-full bg-transparent outline-none text-[14px] text-slate-900 placeholder:text-slate-400 mt-0.5"
        />
      </div>
    </label>
  );
}

function Stat({ n, label }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-slate-900 font-semibold tabular-nums">{n}</span>
      <span>{label}</span>
    </span>
  );
}
