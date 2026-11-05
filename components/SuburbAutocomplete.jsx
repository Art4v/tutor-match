"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

// Reusable Australian-suburb autocomplete. Debounced fetch to /api/places,
// suggestion dropdown, keyboard nav. Emits the *full* place object on select
// ({ label, suburb, state, postcode, lat, lng }) so callers get coords without
// a second round-trip.
//
// Two visual modes:
//   variant="bar"  — a segment of the home-page search bar (small label above
//                    the value, borderless)
//   variant="box"  — a standalone bordered input (browse sidebar, settings)
//
// Props:
//   value        — committed display text (label). Controlled from the parent.
//   onSelect(place)        — a suggestion was chosen.
//   onClear()              — input was emptied (optional).
//   placeholder, icon, label, variant
export function SuburbAutocomplete({
  value = "",
  onSelect,
  onClear,
  placeholder = "Suburb",
  icon = "map-pin",
  label,
  variant = "box",
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);

  // Reflect external value changes (e.g. parent clears the filter).
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click.
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Debounced lookup. Skip when the box already shows a committed selection.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === value) {
      setResults([]);
      return;
    }
    let aborted = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok || aborted) return;
        const body = await res.json();
        if (aborted) return;
        setResults(Array.isArray(body) ? body : []);
        setActive(-1);
        setOpen(true);
      } catch { /* leave previous results on transient error */ }
    }, 250);
    return () => { aborted = true; clearTimeout(t); };
  }, [query, value]);

  const choose = (place) => {
    setQuery(place.label);
    setResults([]);
    setOpen(false);
    onSelect && onSelect(place);
  };

  const onInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    if (v.trim() === "" && onClear) onClear();
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[active >= 0 ? active : 0]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const dropdown = open && results.length > 0 && (
    <div
      className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-rule rounded shadow-float max-h-[264px] overflow-y-auto py-1"
      role="listbox"
    >
      {results.map((p, i) => (
        <button
          key={`${p.label}-${i}`}
          type="button"
          role="option"
          aria-selected={i === active}
          onMouseDown={(e) => { e.preventDefault(); choose(p); }}
          onMouseEnter={() => setActive(i)}
          className={"w-full flex items-center min-h-11 text-left px-3 text-[14px] leading-5 " + (i === active ? "bg-surface-2" : "bg-surface")}
        >
          <span className="text-[color:var(--text)]">{p.suburb}</span>
          {(p.state || p.postcode) && (
            <span className="text-[color:var(--text-2)]">{`, ${[p.state, p.postcode].filter(Boolean).join(" ")}`}</span>
          )}
        </button>
      ))}
    </div>
  );

  // The `icon` prop is still accepted for call-site compatibility, but the
  // field no longer draws it: DESIGN.md allows icons only beside text that says
  // the same thing, and the label above the field already does.
  void icon;

  if (variant === "bar") {
    return (
      <div ref={wrapRef} className="relative border-r border-rule last:border-r-0">
        <div className="w-full flex flex-col justify-center min-h-12 px-4">
          {label && (
            <div className="text-[12px] leading-4 font-semibold text-[color:var(--text-2)]">{label}</div>
          )}
          <input
            value={query}
            onChange={onInput}
            onKeyDown={onKeyDown}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={placeholder}
            aria-label={label || placeholder}
            className="w-full bg-transparent outline-none text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder"
          />
        </div>
        {dropdown}
      </div>
    );
  }

  // variant === "box"
  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 h-11 pl-3 bg-surface border border-input rounded focus-within:border-accent">
        <input
          value={query}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          aria-label={label || placeholder}
          className="w-full min-w-0 bg-transparent outline-none text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder"
        />
        {query ? (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setQuery(""); setResults([]); setOpen(false); onClear && onClear(); }}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--text-2)] hover:text-[color:var(--text)]"
            aria-label="Clear"
          >
            <Icon name="x" size={16} />
          </button>
        ) : (
          <span className="w-1 shrink-0" aria-hidden="true" />
        )}
      </div>
      {dropdown}
    </div>
  );
}
