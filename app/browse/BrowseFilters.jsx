"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Chip } from "@/components/ui";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import { SubjectPicker } from "@/components/SubjectPicker";
import { SchoolPicker } from "@/components/SchoolPicker";
import { useSavedTutors } from "@/components/SavedTutorsProvider";
import { subjectLabel } from "@/lib/subjects";
import { YEAR_LEVELS_DESC, yearLabel } from "@/lib/yearLevels";

/**
 * URL-driven sidebar for /browse. Every change calls router.replace() with a
 * new query string so the server component re-runs the Supabase query.
 *
 * Props:
 *   filters       — current values: { name, subjectSlugs, place, lat, lng, modes[], atarMin, rateMax, yearLevels[] }
 *   catalog        — exam-scoped subject catalog [{ name, slug, exam, examName }, ...]
 *   totalCount     — number, rendered in the header
 *   searchQuery    — current ?q= value, for the header heading
 */
export function BrowseFilters({
  filters,
  catalog,
  schoolCatalog,
  totalCount,
  searchQuery,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  // Saved-tutors filter is a student-only concept — hide the toggle otherwise.
  const { isStudent } = useSavedTutors();

  // Local mirror so sliders feel snappy while the URL update lands.
  const [atarMin, setAtarMin] = useState(filters.atarMin ?? 90);
  const [rateMax, setRateMax] = useState(filters.rateMax ?? 200);
  const nameInputRef = useRef(null);
  const [nameInput, setNameInput] = useState(filters.name ?? "");

  // Year levels are URL-driven (repeated `year=` integer params), same as
  // subjects — `filters.yearLevels` is the source of truth.
  const yearLevels = filters.yearLevels ?? [];
  const setYears = (next) =>
    pushParams((p) => {
      p.delete("year");
      next.forEach((y) => p.append("year", String(y)));
    });
  const toggleYearLevel = (value) => {
    if (value === "all") return setYears([]);
    setYears(
      yearLevels.includes(value)
        ? yearLevels.filter((v) => v !== value)
        : [...yearLevels, value]
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

  // Same contract for the SchoolPicker — repeated `school=` slug params.
  const setSchools = (next) =>
    pushParams((p) => {
      p.delete("school");
      next.forEach((s) => p.append("school", s));
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

  // Verified-only defaults ON; toggling off writes the explicit ?verified=0
  // opt-out, toggling back on just drops the param.
  const setVerifiedOnly = (on) => setSingle("verified", on ? null : "0", null);

  // Saved-only defaults OFF; ON writes ?saved=1, OFF drops the param.
  const setSavedOnly = (on) => setSingle("saved", on ? "1" : null, null);

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

  // Whether any filter (or search query) is active — drives the "Clear all" link.
  const hasActiveFilters =
    !!searchQuery ||
    !!filters.name ||
    (filters.subjectSlugs?.length ?? 0) > 0 ||
    (filters.schoolSlugs?.length ?? 0) > 0 ||
    !!filters.place ||
    (filters.modes?.length ?? 0) > 0 ||
    filters.atarMin != null ||
    filters.rateMax != null ||
    (filters.yearLevels?.length ?? 0) > 0 ||
    filters.savedOnly === true ||
    filters.verifiedOnly === false;

  return (
    <aside className="space-y-6">
      <div>
        <h1 className="text-[40px] leading-none" style={{ color: "var(--ink-graphite)", fontWeight: 300, letterSpacing: "-0.025em" }}>
          {searchQuery ? <>Results for &ldquo;{searchQuery}&rdquo;</> : "All tutors"}
        </h1>
        <div className="text-[14px] text-slate-500 mt-1 tabular-nums">
          {totalCount} tutors match your filters
        </div>
        {hasActiveFilters && (
          <Link
            href="/browse"
            className="text-[12.5px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 mt-3"
          >
            <Icon name="x" size={11} /> Clear all filters
          </Link>
        )}
      </div>

      {/* Saved-tutors filter — pinned to the top, student-only, off by default.
          The TopNav "Saved tutors" link lands here with ?saved=1. */}
      {isStudent && (
        <button
          type="button"
          role="switch"
          aria-checked={filters.savedOnly === true}
          onClick={() => setSavedOnly(filters.savedOnly !== true)}
          className="w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-lg"
          style={{
            border: `1px solid ${filters.savedOnly ? "var(--accent-line)" : "var(--paper-line)"}`,
            background: filters.savedOnly ? "var(--accent-softer)" : "var(--paper-card)",
            transition: "background 160ms ease-out, border-color 160ms ease-out",
          }}
        >
          <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium" style={{ color: filters.savedOnly ? "var(--accent)" : "var(--ink-muted)" }}>
            <Icon name={filters.savedOnly ? "bookmark-fill" : "bookmark"} size={15} />
            Saved tutors
          </span>
          <span
            aria-hidden="true"
            className="relative shrink-0 rounded-full"
            style={{
              width: 38,
              height: 22,
              background: filters.savedOnly ? "var(--accent)" : "var(--paper-line)",
              transition: "background 160ms ease-out",
            }}
          >
            <span
              className="absolute top-1/2 rounded-full bg-white shadow-sm"
              style={{
                width: 16,
                height: 16,
                transform: `translateY(-50%) translateX(${filters.savedOnly ? 19 : 3}px)`,
                transition: "transform 160ms ease-out",
              }}
            />
          </span>
        </button>
      )}

      <FilterGroup title="Name">
        <div className="flex items-center gap-2 h-9 px-3" style={{ border: "1px solid var(--paper-line)", borderRadius: 8, background: "var(--paper-card)" }}>
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
          <Chip active={yearLevels.length === 0} onClick={() => toggleYearLevel("all")}>
            All
          </Chip>
          {YEAR_LEVELS_DESC.map((y) => (
            <Chip
              key={y.value}
              active={yearLevels.includes(y.value)}
              onClick={() => toggleYearLevel(y.value)}
            >
              {y.label}
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

      <FilterGroup title="School">
        <SchoolPicker
          catalog={schoolCatalog}
          value={filters.schoolSlugs}
          onChange={setSchools}
          placeholder="Add schools"
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

      <FilterGroup title="Verification">
        <button
          type="button"
          role="switch"
          aria-checked={filters.verifiedOnly !== false}
          onClick={() => setVerifiedOnly(filters.verifiedOnly === false)}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <span className="inline-flex items-center gap-1.5 text-[13.5px] text-slate-700">
            <span className="inline-flex" style={{ color: "var(--accent)" }}>
              <Icon name="check-badge" size={15} />
            </span>
            Verified tutors only
          </span>
          <span
            aria-hidden="true"
            className="relative shrink-0 rounded-full"
            style={{
              width: 38,
              height: 22,
              background: filters.verifiedOnly !== false ? "var(--accent)" : "var(--paper-line)",
              transition: "background 160ms ease-out",
            }}
          >
            <span
              className="absolute top-1/2 rounded-full bg-white shadow-sm"
              style={{
                width: 16,
                height: 16,
                transform: `translateY(-50%) translateX(${filters.verifiedOnly !== false ? 19 : 3}px)`,
                transition: "transform 160ms ease-out",
              }}
            />
          </span>
        </button>
      </FilterGroup>
    </aside>
  );
}

export function BrowseSortAndChips({ filters, catalog, schoolCatalog }) {
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

  const removeSchool = (slug) =>
    pushParams((p) => {
      const rest = p.getAll("school").filter((s) => s !== slug);
      p.delete("school");
      rest.forEach((s) => p.append("school", s));
    });

  const removeMode = (value) =>
    pushParams((p) => {
      const rest = p.getAll("mode").filter((v) => v !== value);
      p.delete("mode");
      rest.forEach((v) => p.append("mode", v));
    });

  const removeYear = (value) =>
    pushParams((p) => {
      const rest = p.getAll("year").filter((v) => Number(v) !== value);
      p.delete("year");
      rest.forEach((v) => p.append("year", v));
    });

  const subjectNameFor = (slug) =>
    subjectLabel((catalog ?? []).find((s) => s.slug === slug) ?? { name: slug });

  const schoolNameFor = (slug) =>
    (schoolCatalog ?? []).find((s) => s.slug === slug)?.name ?? slug;

  return (
    <div className="mb-5">
      <div className="flex flex-wrap gap-1.5">
        {filters.savedOnly && (
          <Chip onClick={() => pushParams((p) => p.delete("saved"))} icon="x">
            Saved tutors
          </Chip>
        )}
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
        {(filters.schoolSlugs ?? []).map((slug) => (
          <Chip key={slug} onClick={() => removeSchool(slug)} icon="x">
            {schoolNameFor(slug)}
          </Chip>
        ))}
        {(filters.modes ?? []).map((m) => (
          <Chip key={m} onClick={() => removeMode(m)} icon="x">
            {m === "online" ? "Online" : "In-person"}
          </Chip>
        ))}
        {(filters.yearLevels ?? []).map((y) => (
          <Chip key={y} onClick={() => removeYear(y)} icon="x">
            {yearLabel(y)}
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
        className="w-full flex items-center justify-between text-[12.5px] font-medium text-slate-900 uppercase tracking-wider mb-2.5 hover:text-slate-700"
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
