"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Button, Chip } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { SuburbAutocomplete } from "@/components/SuburbAutocomplete";
import { SubjectPicker } from "@/components/SubjectPicker";
import { CatalogPicker } from "@/components/CatalogPicker";
import { useSavedTutors } from "@/components/SavedTutorsProvider";
import { useRouteLoading } from "@/components/RouteLoadingProvider";
import { subjectLabel } from "@/lib/subjects";
import { YEAR_LEVELS_DESC, yearLabel } from "@/lib/yearLevels";
import { AU_STATES, stateName } from "@/lib/states";

/**
 * URL-driven filters for /browse. Every change calls router.replace() (through
 * the route-loading overlay) with a new query string so the server component
 * re-runs the Supabase query. The URL is the only source of truth.
 *
 * Layout (DESIGN.md, REDESIGN_DECISIONS.md item 4):
 *   >= 1024px  a left sidebar: page title + count, then rule-separated groups,
 *              with School / Minimum ATAR / Max rate / Verification under a
 *              "More filters" disclosure.
 *   <  1024px  title + count + a "Filters (n)" button; the same controls open
 *              in the shared Modal as a sheet (full screen on phones), so the
 *              results come first.
 *
 * The controls render in both places from ONE set of state held here, so the
 * name box and sliders never disagree between the sidebar and the sheet.
 *
 * Props:
 *   filters       — current values: { name, subjectSlugs, schoolSlugs, states[], place, lat, lng, modes[], atarMin, rateMax, yearLevels[], verifiedOnly, savedOnly }
 *   catalog        — exam-scoped subject catalog [{ name, slug, exam, examName }, ...]
 *   schoolCatalog  — [{ name, slug }]
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
  const pathname = usePathname();
  const sp = useSearchParams();
  // Route filter changes through the loading overlay: the server re-query can
  // be slow, and this is the only feedback the user gets.
  const { navigate } = useRouteLoading();
  // Saved-tutors filter is a student-only concept, so hide the toggle otherwise.
  const { isStudent } = useSavedTutors();

  const [sheetOpen, setSheetOpen] = useState(false);

  // Local mirror so sliders feel snappy while the URL update lands.
  const [atarMin, setAtarMin] = useState(filters.atarMin ?? 90);
  const [rateMax, setRateMax] = useState(filters.rateMax ?? 200);
  const [nameInput, setNameInput] = useState(filters.name ?? "");
  // The name box exists twice (sidebar + sheet), so focus is tracked with a
  // flag rather than a single element ref.
  const nameFocused = useRef(false);

  // Keep the slider mirrors in step when a chip removal or "Clear all" resets them.
  useEffect(() => { setAtarMin(filters.atarMin ?? 90); }, [filters.atarMin]);
  useEffect(() => { setRateMax(filters.rateMax ?? 200); }, [filters.rateMax]);

  // Year levels are URL-driven (repeated `year=` integer params), same as
  // subjects: `filters.yearLevels` is the source of truth.
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
    navigate(qs ? `${pathname}?${qs}` : pathname, { replace: true, scroll: false });
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

  // Same contract for the school picker: repeated `school=` slug params.
  const setSchools = (next) =>
    pushParams((p) => {
      p.delete("school");
      next.forEach((s) => p.append("school", s));
    });

  // And for the state picker: repeated `state=` params, each an AU state code.
  const setStates = (next) =>
    pushParams((p) => {
      p.delete("state");
      next.forEach((s) => p.append("state", s));
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
    if (!nameFocused.current) setNameInput(filters.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.name]);

  // Number of active filters, for the compact "Filters (n)" button. The ?q=
  // search is not a filter control, so it is not counted.
  const activeCount =
    (filters.name ? 1 : 0) +
    (filters.subjectSlugs?.length ?? 0) +
    (filters.schoolSlugs?.length ?? 0) +
    (filters.states?.length ?? 0) +
    (filters.place ? 1 : 0) +
    (filters.modes?.length ?? 0) +
    (filters.atarMin != null ? 1 : 0) +
    (filters.rateMax != null ? 1 : 0) +
    (filters.yearLevels?.length ?? 0) +
    (filters.savedOnly === true ? 1 : 0) +
    (filters.verifiedOnly === false ? 1 : 0);

  // Whether any filter (or search query) is active: drives the "Clear all" link.
  const hasActiveFilters = !!searchQuery || activeCount > 0;

  // "More filters" starts open when one of its controls is already in use, so
  // an active filter is never hidden behind a closed disclosure.
  const moreActive =
    (filters.schoolSlugs?.length ?? 0) > 0 ||
    filters.atarMin != null ||
    filters.rateMax != null ||
    filters.verifiedOnly === false;
  const [moreOpen, setMoreOpen] = useState(moreActive);
  useEffect(() => { if (moreActive) setMoreOpen(true); }, [moreActive]);

  const controls = (
    <div className="border-b border-rule">
      {/* Saved-tutors filter: pinned to the top, student-only, off by default.
          The TopNav "Saved tutors" link lands here with ?saved=1. */}
      {isStudent && (
        <FilterGroup>
          <CheckRow
            checked={filters.savedOnly === true}
            onChange={(on) => setSavedOnly(on)}
            label="Saved tutors only"
          />
        </FilterGroup>
      )}

      <FilterGroup title="Name">
        <div className="flex items-center gap-2 h-11 px-3 bg-surface border border-input rounded focus-within:border-accent">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onFocus={() => { nameFocused.current = true; }}
            onBlur={() => { nameFocused.current = false; }}
            placeholder="Search by name"
            aria-label="Tutor name"
            className="w-full min-w-0 bg-transparent outline-none text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder"
          />
          {nameInput && (
            <button
              type="button"
              onClick={() => setNameInput("")}
              className="-mr-3 inline-flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--text-2)] hover:text-[color:var(--text)]"
              aria-label="Clear name"
            >
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
      </FilterGroup>

      <FilterGroup title="Location">
        <SuburbAutocomplete
          variant="box"
          placeholder="Any suburb in Australia"
          value={filters.place ?? ""}
          onSelect={setLocation}
          onClear={() => setLocation(null)}
        />
        {filters.place && (
          <p className="text-[12px] leading-4 text-muted mt-1">
            Tutors who travel to {filters.place}
          </p>
        )}
      </FilterGroup>

      <FilterGroup title="State">
        <CatalogPicker
          kind="state"
          catalog={AU_STATES}
          value={filters.states}
          onChange={setStates}
          placeholder="Any state"
        />
      </FilterGroup>

      <FilterGroup title="Year level">
        <div className="grid grid-cols-4 gap-2">
          <ToggleButton active={yearLevels.length === 0} onClick={() => toggleYearLevel("all")}>
            All
          </ToggleButton>
          {YEAR_LEVELS_DESC.map((y) => (
            <ToggleButton
              key={y.value}
              active={yearLevels.includes(y.value)}
              onClick={() => toggleYearLevel(y.value)}
              ariaLabel={y.label}
            >
              {y.short}
            </ToggleButton>
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

      <FilterGroup title="Lesson type">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Online", value: "online" },
            { label: "In person", value: "inperson" },
          ].map((m) => (
            <ToggleButton
              key={m.value}
              active={filters.modes.includes(m.value)}
              onClick={() => toggleMode(m.value)}
            >
              {m.label}
            </ToggleButton>
          ))}
        </div>
      </FilterGroup>

      <div className="border-t border-rule">
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className="w-full flex items-center justify-between h-12 text-left text-[14px] leading-5 font-semibold text-[color:var(--text)] hover:text-accent"
        >
          More filters
          <Icon name={moreOpen ? "chevron-up" : "chevron-down"} size={16} />
        </button>
      </div>

      {moreOpen && (
        <>
          <FilterGroup title="School">
            <CatalogPicker
              kind="school"
              catalog={schoolCatalog}
              value={filters.schoolSlugs}
              onChange={setSchools}
              placeholder="Add schools"
            />
          </FilterGroup>

          <FilterGroup title="Minimum ATAR" value={atarMin.toFixed(2)}>
            <input
              type="range"
              min="90"
              max="99.95"
              step="0.05"
              value={atarMin}
              aria-label="Minimum ATAR"
              onChange={(e) => setAtarMin(parseFloat(e.target.value))}
              onMouseUp={(e) => setSingle("atarMin", parseFloat(e.target.value), 90)}
              onTouchEnd={(e) => setSingle("atarMin", parseFloat(e.target.value), 90)}
              className="w-full h-11 accent-[color:var(--accent)]"
            />
            <div className="flex justify-between text-[12px] leading-4 text-muted tabular-nums">
              <span>90.00</span><span>99.95</span>
            </div>
          </FilterGroup>

          <FilterGroup title="Max rate" value={`$${rateMax} per hour`}>
            <input
              type="range"
              min="30"
              max="200"
              step="5"
              value={rateMax}
              aria-label="Maximum hourly rate"
              onChange={(e) => setRateMax(parseInt(e.target.value))}
              onMouseUp={(e) => setSingle("rateMax", parseInt(e.target.value), 200)}
              onTouchEnd={(e) => setSingle("rateMax", parseInt(e.target.value), 200)}
              className="w-full h-11 accent-[color:var(--accent)]"
            />
            <div className="flex justify-between text-[12px] leading-4 text-muted tabular-nums">
              <span>$30</span><span>$200</span>
            </div>
          </FilterGroup>

          <FilterGroup title="Verification">
            <CheckRow
              checked={filters.verifiedOnly !== false}
              onChange={(on) => setVerifiedOnly(on)}
              label="Verified tutors only"
            />
          </FilterGroup>
        </>
      )}
    </div>
  );

  const countLine = `${totalCount} ${totalCount === 1 ? "result" : "results"}`;

  return (
    <aside className="min-w-0">
      <h1 className="text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-semibold text-[color:var(--text)] [overflow-wrap:anywhere]">
        {searchQuery ? <>Results for &ldquo;{searchQuery}&rdquo;</> : "All tutors"}
      </h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-[14px] leading-5 text-[color:var(--text-2)] tabular-nums">{countLine}</p>
        {hasActiveFilters && (
          <Link
            href="/browse"
            className="inline-flex items-center min-h-6 text-[14px] leading-5 text-accent hover:text-accent-hover"
          >
            Clear all
          </Link>
        )}
      </div>

      {/* Compact: one button opens the same controls as a sheet. */}
      <div className="mt-4 lg:hidden">
        <Button variant="outline" icon="sliders" onClick={() => setSheetOpen(true)}>
          {activeCount > 0 ? `Filters (${activeCount})` : "Filters"}
        </Button>
      </div>

      <div className="hidden lg:block mt-6">{controls}</div>

      {sheetOpen && (
        <Modal
          title="Filters"
          sheet
          width={480}
          onClose={() => setSheetOpen(false)}
          footer={
            <>
              {hasActiveFilters && (
                <Link
                  href="/browse"
                  onClick={() => setSheetOpen(false)}
                  className="inline-flex items-center h-11 px-4 text-[14px] leading-5 font-semibold text-accent hover:text-accent-hover"
                >
                  Clear all
                </Link>
              )}
              <Button variant="primary" onClick={() => setSheetOpen(false)}>
                {`Show ${countLine}`}
              </Button>
            </>
          }
        >
          {controls}
        </Modal>
      )}
    </aside>
  );
}

export function BrowseSortAndChips({ filters, catalog, schoolCatalog }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const { navigate } = useRouteLoading();

  function pushParams(mutate) {
    const params = new URLSearchParams(sp.toString());
    mutate(params);
    params.delete("page");
    const qs = params.toString();
    navigate(qs ? `${pathname}?${qs}` : pathname, { replace: true, scroll: false });
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

  const removeState = (code) =>
    pushParams((p) => {
      const rest = p.getAll("state").filter((s) => s !== code);
      p.delete("state");
      rest.forEach((s) => p.append("state", s));
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

  const chips = [];
  if (filters.savedOnly) chips.push({ key: "saved", label: "Saved tutors", remove: () => pushParams((p) => p.delete("saved")) });
  if (filters.name) chips.push({ key: "name", label: <>&ldquo;{filters.name}&rdquo;</>, remove: () => pushParams((p) => p.delete("name")) });
  filters.subjectSlugs.forEach((slug) => chips.push({ key: `s-${slug}`, label: subjectNameFor(slug), remove: () => removeSubject(slug) }));
  (filters.schoolSlugs ?? []).forEach((slug) => chips.push({ key: `sc-${slug}`, label: schoolNameFor(slug), remove: () => removeSchool(slug) }));
  (filters.states ?? []).forEach((code) => chips.push({ key: `st-${code}`, label: stateName(code), remove: () => removeState(code) }));
  (filters.modes ?? []).forEach((m) => chips.push({ key: `m-${m}`, label: m === "online" ? "Online" : "In person", remove: () => removeMode(m) }));
  (filters.yearLevels ?? []).forEach((y) => chips.push({ key: `y-${y}`, label: yearLabel(y), remove: () => removeYear(y) }));
  if (filters.place) {
    chips.push({
      key: "place",
      label: <>Near {filters.place}</>,
      remove: () => pushParams((p) => { p.delete("lat"); p.delete("lng"); p.delete("place"); }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((c) => (
        <Chip key={c.key} onClick={c.remove} icon="x">
          {c.label}
        </Chip>
      ))}
    </div>
  );
}

// A filter group: plain sentence-case label (optionally with the current value
// on the right), content, and a rule above it.
function FilterGroup({ title, value, children }) {
  return (
    <div className="border-t border-rule py-4">
      {title && (
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="text-[14px] leading-5 font-semibold text-[color:var(--text)]">{title}</span>
          {value != null && (
            <span className="text-[14px] leading-5 text-[color:var(--text-2)] tabular-nums">{value}</span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// A 44px toggle for the year and lesson-type groups. 4px radius, no pill;
// the selected state uses the accent.
function ToggleButton({ active, onClick, children, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={`h-11 min-w-0 rounded border text-[14px] leading-5 font-semibold ${
        active
          ? "bg-accent border-accent text-white hover:bg-accent-hover hover:border-accent-hover"
          : "bg-surface border-input text-[color:var(--text)] hover:bg-surface-2"
      }`}
      style={{ transition: "background-color 120ms ease-out, border-color 120ms ease-out" }}
    >
      {children}
    </button>
  );
}

// A labelled checkbox row, 44px tall. The checkbox fires `onChange(next)`.
function CheckRow({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 min-h-11 cursor-pointer text-[14px] leading-5 text-[color:var(--text)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-[color:var(--accent)]"
      />
      {label}
    </label>
  );
}
