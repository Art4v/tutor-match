"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Chip } from "@/components/ui";

const YEAR_OPTIONS = [
  "All", "Kindergarden", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5",
  "Year 6", "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12",
];

/**
 * URL-driven sidebar for /browse. Every change calls router.replace() with a
 * new query string so the server component re-runs the Supabase query.
 *
 * Props:
 *   filters       — current values: { subjectSlugs, city, mode, atarMin, rateMax, yearLevel }
 *   subjectOptions — [{ name, slug }, ...]
 *   cityOptions    — string[]
 *   totalCount     — number, rendered in the header
 *   searchQuery    — current ?q= value, for the header heading
 */
export function BrowseFilters({
  filters,
  subjectOptions,
  cityOptions,
  totalCount,
  searchQuery,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Local mirror so sliders feel snappy while the URL update lands.
  const [atarMin, setAtarMin] = useState(filters.atarMin ?? 90);
  const [rateMax, setRateMax] = useState(filters.rateMax ?? 200);
  const [yearLevel, setYearLevel] = useState(filters.yearLevel ?? "All");

  function pushParams(mutate) {
    const params = new URLSearchParams(sp.toString());
    mutate(params);
    params.delete("page"); // any filter change resets pagination
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const setSingle = (key, value, defaultValue) =>
    pushParams((p) => {
      if (value == null || value === "" || value === defaultValue) p.delete(key);
      else p.set(key, String(value));
    });

  const toggleSubject = (slug) =>
    pushParams((p) => {
      const current = p.getAll("subject");
      p.delete("subject");
      const next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug];
      next.forEach((s) => p.append("subject", s));
    });

  return (
    <aside className="space-y-6">
      <div>
        <div className="flex items-center gap-1.5 text-[12.5px] text-slate-500 mb-3">
          <Link href="/" className="hover:text-slate-900">Home</Link>
          <Icon name="chevron-right" size={12} />
          <span className="text-slate-700">All tutors</span>
        </div>
        <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight">
          {searchQuery ? <>Results for &ldquo;{searchQuery}&rdquo;</> : "All tutors"}
        </h1>
        <div className="text-[14px] text-slate-500 mt-1 tabular-nums">
          {totalCount} tutors match your filters
        </div>
      </div>

      <FilterGroup title="Location">
        <select
          value={filters.city ?? "All"}
          onChange={(e) => setSingle("city", e.target.value === "All" ? "" : e.target.value, "")}
          className="w-full h-9 px-3 text-[13.5px] outline-none"
          style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }}
        >
          <option>All</option>
          {cityOptions.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup title="Year level">
        <div className="grid grid-cols-2 gap-1.5">
          {YEAR_OPTIONS.map((y) => (
            <Chip
              key={y}
              active={yearLevel === y}
              onClick={() => setYearLevel(y)}
            >
              {y}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Subject">
        <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-auto pr-1">
          {subjectOptions.map((s) => (
            <Chip
              key={s.slug}
              active={filters.subjectSlugs.includes(s.slug)}
              onClick={() => toggleSubject(s.slug)}
            >
              {s.name}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Mode">
        <div className="flex gap-1.5">
          {[
            { label: "Any", value: "" },
            { label: "Online", value: "online" },
            { label: "In-person", value: "inperson" },
          ].map((m) => (
            <Chip
              key={m.label}
              active={(filters.mode ?? "") === m.value}
              onClick={() => setSingle("mode", m.value, "")}
            >
              {m.label}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={`Minimum ATAR · ${atarMin.toFixed(2)}`}>
        <input
          type="range"
          min="90"
          max="99.95"
          step="0.05"
          value={atarMin}
          onChange={(e) => setAtarMin(parseFloat(e.target.value))}
          onMouseUp={(e) => setSingle("atarMin", parseFloat(e.target.value), 90)}
          onTouchEnd={(e) => setSingle("atarMin", parseFloat(e.target.value), 90)}
          className="w-full accent-slate-900"
        />
        <div className="flex justify-between text-[11px] text-slate-400 tabular-nums mt-1">
          <span>90.00</span><span>99.95</span>
        </div>
      </FilterGroup>

      <FilterGroup title={`Max rate · $${rateMax}/hr`}>
        <input
          type="range"
          min="30"
          max="200"
          step="5"
          value={rateMax}
          onChange={(e) => setRateMax(parseInt(e.target.value))}
          onMouseUp={(e) => setSingle("rateMax", parseInt(e.target.value), 200)}
          onTouchEnd={(e) => setSingle("rateMax", parseInt(e.target.value), 200)}
          className="w-full accent-slate-900"
        />
        <div className="flex justify-between text-[11px] text-slate-400 tabular-nums mt-1">
          <span>$30</span><span>$200</span>
        </div>
      </FilterGroup>

      <Link
        href="/browse"
        className="text-[12.5px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
      >
        <Icon name="x" size={11} /> Clear all filters
      </Link>
    </aside>
  );
}

export function BrowseSortAndChips({ filters, subjectOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function pushParams(mutate) {
    const params = new URLSearchParams(sp.toString());
    mutate(params);
    params.delete("page");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const removeSubject = (slug) =>
    pushParams((p) => {
      const rest = p.getAll("subject").filter((s) => s !== slug);
      p.delete("subject");
      rest.forEach((s) => p.append("subject", s));
    });

  const subjectNameFor = (slug) => subjectOptions.find((s) => s.slug === slug)?.name ?? slug;

  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex flex-wrap gap-1.5">
        {filters.subjectSlugs.map((slug) => (
          <Chip key={slug} onClick={() => removeSubject(slug)} icon="x">
            {subjectNameFor(slug)}
          </Chip>
        ))}
        {filters.mode && filters.mode !== "any" && (
          <Chip onClick={() => pushParams((p) => p.delete("mode"))} icon="x">
            {filters.mode === "online" ? "Online" : "In-person"}
          </Chip>
        )}
        {filters.city && (
          <Chip onClick={() => pushParams((p) => p.delete("city"))} icon="x">
            {filters.city}
          </Chip>
        )}
      </div>
      <label className="flex items-center gap-2 text-[13px] text-slate-500">
        Sort:
        <select
          value={filters.sort ?? "relevance"}
          onChange={(e) => pushParams((p) => {
            if (!e.target.value || e.target.value === "relevance") p.delete("sort");
            else p.set("sort", e.target.value);
          })}
          className="h-8 px-2.5 outline-none text-[13px] text-slate-900"
          style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }}
        >
          <option value="relevance">Most relevant</option>
          <option value="rating">Highest rated</option>
          <option value="rate-asc">Lowest rate</option>
          <option value="newest">Most reviewed</option>
        </select>
      </label>
    </div>
  );
}

function FilterGroup({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-[12.5px] font-semibold text-slate-900 uppercase tracking-wider mb-2.5 hover:text-slate-700"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span
          className="inline-flex text-slate-500"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 150ms ease-out" }}
        >
          <Icon name="chevron-down" size={14} />
        </span>
      </button>
      {open && children}
    </div>
  );
}
