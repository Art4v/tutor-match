"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/ui";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import { SubjectPicker } from "@/components/SubjectPicker";

const YEAR_OPTIONS = [
  "Kindergarden", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6",
  "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12",
];

/**
 * catalog: exam-scoped subject catalog from getSubjects(). The picker is
 * exam-first; the form submits the selected slug as ?subject= so /browse
 * matches the URL contract.
 */
export function HomeHero({ catalog }) {
  const router = useRouter();
  const [place, setPlace] = useState(null); // { label, lat, lng, ... } | null
  const [year, setYear] = useState("");
  const [subject, setSubject] = useState(null); // { name, slug } | null

  const goBrowse = () => {
    const params = new URLSearchParams();
    if (subject?.slug) params.append("subject", subject.slug);
    if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
      params.set("lat", String(place.lat));
      params.set("lng", String(place.lng));
      params.set("place", place.label);
    }
    if (year) params.set("year", year);
    const qs = params.toString();
    router.push(`/browse${qs ? `?${qs}` : ""}`);
  };

  return (
    <section className="max-w-[1200px] mx-auto px-6 pt-40 pb-16">
      <div className="max-w-[820px]">
        <h1 className="text-[56px] md:text-[64px] font-semibold text-slate-900 leading-[1.05] tracking-[-0.025em]">
          Find a tutor who&apos;s<br />
          <span className="text-slate-500">been where you&apos;re going.</span>
        </h1>
        <p className="text-[17px] text-slate-600 mt-6 leading-[1.55] max-w-[560px]">
          High school students across Australia are using tutormatch to work with the country&apos;s strongest recent graduates — verified ATARs, real reviews, no agency markup.
        </p>

        <div
          className="mt-10 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1.4fr_auto] items-stretch bg-white max-w-[860px]"
          style={{ border: "1px solid #E5E7EB", borderRadius: 14 }}
        >
          <SuburbAutocomplete
            variant="bar"
            icon="map-pin"
            label="Location"
            placeholder="Any AU suburb"
            value={place?.label ?? ""}
            onSelect={setPlace}
            onClear={() => setPlace(null)}
          />
          <SearchField
            icon="graduation"
            label="Year"
            placeholder="Year 12"
            options={YEAR_OPTIONS.map((o) => ({ label: o, value: o }))}
            value={year}
            onChange={setYear}
          />
          <SubjectPicker
            catalog={catalog}
            value={subject?.slug ?? null}
            onChange={(slug, sub) => setSubject(slug ? { slug, name: sub?.name, exam: sub?.exam } : null)}
            mode="single"
            variant="bar"
            label="Subject"
            placeholder="Any subject"
          />
          <div className="p-2 md:p-1.5 flex items-stretch">
            <Button variant="primary" size="lg" icon="search" onClick={goBrowse} full>Search</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SearchField({ icon, label, placeholder, value, onChange, options = [], displayValue }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const select = (opt) => {
    onChange && onChange(opt.value, opt.label);
    setOpen(false);
  };

  const shownText = displayValue ?? value;

  return (
    <div ref={wrapRef} className="relative border-r last:border-r-0" style={{ borderColor: "#E5E7EB" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Icon name={icon} size={16} className="text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</div>
          <div className={"text-[14px] mt-0.5 truncate " + (shownText ? "text-slate-900" : "text-slate-400")}>
            {shownText || placeholder}
          </div>
        </div>
        <Icon name="chevron-down" size={14} className="text-slate-400 shrink-0" />
      </button>
      {open && options.length > 0 && (
        <div
          className="absolute left-2 right-2 top-full mt-2 z-40 bg-white max-h-[260px] overflow-y-auto"
          style={{ border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 10px 24px -8px rgba(15,23,42,0.12)" }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt)}
              className="w-full text-left px-3 py-2 text-[13.5px] text-slate-700 hover:bg-slate-100"
              style={{ background: value === opt.value ? "#F3F4F6" : "transparent" }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
