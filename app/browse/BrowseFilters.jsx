"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Chip } from "@/components/ui";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import { SubjectPicker } from "@/components/SubjectPicker";
import { subjectLabel } from "@/lib/subjects";

const YEAR_OPTIONS = [
  "All", "Kindergarden", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5",
  "Year 6", "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12",
];

/**
 * URL-driven sidebar for /browse. Every change calls router.replace() with a
 * new query string so the server component re-runs the Supabase query.
 *
 * Props:
 *   filters       — current values: { name, subjectSlugs, place, lat, lng, modes[], atarMin, rateMax, yearLevel }
 *   catalog        — exam-scoped subject catalog [{ name, slug, exam, examName }, ...]
 *   totalCount     — number, rendered in the header
 *   searchQuery    — current ?q= value, for the header heading
 */
export function BrowseFilters({
  filters,
  catalog,
  totalCount,
  searchQuery,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // Local mirror so sliders feel snappy while the URL update lands.
  const [atarMin, setAtarMin] = useState(filters.atarMin ?? 90);
  const [rateMax, setRateMax] = useState(filters.rateMax ?? 200);
  const nameInputRef = useRef(null);
  const [nameInput, setNameInput] = useState(filters.name ?? "");
  const [yearLevels, setYearLevels] = useState(() => {
    const initial = filters.yearLevel;
    if (Array.isArray(initial)) return initial.filter((y) => y && y !== "All");
    if (!initial || initial === "All") return [];
    return [initial];
  });

  const toggleYearLevel = (y) => {
    if (y === "All") {
      setYearLevels([]);
      return;
    }
    setYearLevels((curr) =>
      curr.includes(y) ? curr.filter((v) => v !== y) : [...curr, y]
    );
  };

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

  // The SubjectPicker emits the full next slug array; mirror it into the URL.
  const setSubjects = (next) =>
    pushParams((p) => {
      p.delete("subject");
      next.forEach((s) => p.append("subject", s));
    });

  const setLocation = (place) =>
    pushParams((p) => {
      if (place && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
        p.set("lat", String(place.lat));
        p.set("lng", String(place.lng));
        p.set("place", place.label);
      } else {
        p.delete("lat"); p.delete("lng"); p.delete("place");
      }
    });

  const toggleMode = (value) =>
    pushParams((p) => {
      const current = p.getAll("mode");
      p.delete("mode");
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      next.forEach((v) => p.append("mode", v));
    });

  // Name search: debounce the input to the URL so we don't router.replace on
  // every keystroke. The reverse-sync only fires when the field isn't focused,
  // so a chip-remove / clear-all resets the box without clobbering live typing.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.name ?? "") !== nameInput.trim()) setSingle("name", nameInput.trim(), "");
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameInput]);

  useEffect(() => {
    if (document.activeElement !== nameInputRef.current) setNameInput(filters.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.name]);

  return (
    <aside className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight">
          {searchQuery ? <>Results for &ldquo;{searchQuery}&rdquo;</> : "All tutors"}
        </h1>
        <div className="text-[14px] text-slate-500 mt-1 tabular-nums">
          {totalCount} tutors match your filters
        </div>
        <Link
          href="/browse"
          className="text-[12.5px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 mt-3"
        >
          <Icon name="x" size={11} /> Clear all filters
        </Link>
      </div>

      <FilterGroup title="Name">
        <div className="flex items-center gap-2 h-9 px-3" style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }}>
          <Icon name="user" size={14} className="text-slate-400 shrink-0" />
          <input
            ref={nameInputRef}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Search by name"
            className="w-full bg-transparent outline-none text-[13.5px] text-slate-900 placeholder:text-slate-400"
          />
          {nameInput && (
            <button
              type="button"
              onClick={() => setNameInput("")}
              className="text-slate-400 hover:text-slate-700 shrink-0"
              aria-label="Clear name"
            >
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
      </FilterGroup>

      <FilterGroup title="Location">
        <SuburbAutocomplete
          variant="box"
          placeholder="Any AU suburb"
          value={filters.place ?? ""}
          onSelect={setLocation}
          onClear={() => setLocation(null)}
        />
        {filters.place && (
          <div className="text-[12px] text-slate-500 mt-1.5">
            Tutors who travel to {filters.place}
          </div>
        )}
      </FilterGroup>

      <FilterGroup title="Year level">
        <div className="grid grid-cols-2 gap-1.5">
          {YEAR_OPTIONS.map((y) => (
            <Chip
              key={y}
              active={y === "All" ? yearLevels.length === 0 : yearLevels.includes(y)}
              onClick={() => toggleYearLevel(y)}
            >
              {y}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Subject">
        <SubjectPicker
          catalog={catalog}
          value={filters.subjectSlugs}
          onChange={setSubjects}
          mode="multi"
          variant="box"
          placeholder="Add subjects"
        />
      </FilterGroup>

      <FilterGroup title="Mode">
        <div className="flex gap-1.5">
          {[
            { label: "Online", value: "online" },
            { label: "In-person", value: "inperson" },
          ].map((m) => (
            <Chip
              key={m.value}
              active={filters.modes.includes(m.value)}
              onClick={() => toggleMode(m.value)}
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
    </aside>
  );
}

export function BrowseSortAndChips({ filters, catalog }) {
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

  const removeMode = (value) =>
    pushParams((p) => {
      const rest = p.getAll("mode").filter((v) => v !== value);
      p.delete("mode");
      rest.forEach((v) => p.append("mode", v));
    });

  const subjectNameFor = (slug) =>
    subjectLabel((catalog ?? []).find((s) => s.slug === slug) ?? { name: slug });

  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex flex-wrap gap-1.5">
        {filters.name && (
          <Chip onClick={() => pushParams((p) => p.delete("name"))} icon="x">
            &ldquo;{filters.name}&rdquo;
          </Chip>
        )}
        {filters.subjectSlugs.map((slug) => (
          <Chip key={slug} onClick={() => removeSubject(slug)} icon="x">
            {subjectNameFor(slug)}
          </Chip>
        ))}
        {(filters.modes ?? []).map((m) => (
          <Chip key={m} onClick={() => removeMode(m)} icon="x">
            {m === "online" ? "Online" : "In-person"}
          </Chip>
        ))}
        {filters.place && (
          <Chip
            onClick={() => pushParams((p) => { p.delete("lat"); p.delete("lng"); p.delete("place"); })}
            icon="x"
          >
            Near {filters.place}
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
