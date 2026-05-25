"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

// Reusable Australian-suburb autocomplete. Debounced fetch to /api/places,
// suggestion dropdown, keyboard nav. Emits the *full* place object on select
// ({ label, suburb, state, postcode, lat, lng }) so callers get coords without
// a second round-trip.
//
// Two visual modes:
//   variant="bar"  — a segment of the home-page search bar (icon + small label
//                    above the value, borderless; matches HomeHero's SearchField)
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
      className="absolute left-0 right-0 top-full mt-2 z-50 bg-white max-h-[260px] overflow-y-auto"
      style={{ border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 10px 24px -8px rgba(15,23,42,0.12)" }}
    >
      {results.map((p, i) => (
        <button
          key={`${p.label}-${i}`}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); choose(p); }}
          onMouseEnter={() => setActive(i)}
          className="w-full text-left px-3 py-2 text-[13.5px] text-slate-700 hover:bg-slate-100"
          style={{ background: i === active ? "#F3F4F6" : "transparent" }}
        >
          <span className="text-slate-900">{p.suburb}</span>
          {(p.state || p.postcode) && (
            <span className="text-slate-400">{`, ${[p.state, p.postcode].filter(Boolean).join(" ")}`}</span>
          )}
        </button>
      ))}
    </div>
  );

  if (variant === "bar") {
    return (
      <div ref={wrapRef} className="relative border-r last:border-r-0" style={{ borderColor: "#E5E7EB" }}>
        <div className="w-full flex items-center gap-3 px-4 py-3">
          {icon && <Icon name={icon} size={16} className="text-slate-400 shrink-0" />}
          <div className="flex-1 min-w-0">
            {label && (
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</div>
            )}
            <input
              value={query}
              onChange={onInput}
              onKeyDown={onKeyDown}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder={placeholder}
              className="w-full bg-transparent outline-none text-[14px] mt-0.5 text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>
        {dropdown}
      </div>
    );
  }

  // variant === "box"
  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 h-9 px-3" style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }}>
        {icon && <Icon name={icon} size={14} className="text-slate-400 shrink-0" />}
        <input
          value={query}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-[13.5px] text-slate-900 placeholder:text-slate-400"
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setQuery(""); setResults([]); setOpen(false); onClear && onClear(); }}
            className="text-slate-400 hover:text-slate-700 shrink-0"
            aria-label="Clear"
          >
            <Icon name="x" size={13} />
          </button>
        )}
      </div>
      {dropdown}
    </div>
  );
}
