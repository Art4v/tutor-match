"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * School field for the education editor. Behaves like SuburbAutocomplete: a plain
 * text input that surfaces a dropdown of matches AS YOU TYPE. Picking a listed
 * school records a structured slug; anything not in the list is kept as free text
 * (schoolSlug = null). The display `school` name is always set either way, so
 * profile/card rendering is unchanged.
 *
 * Matches the seeded catalog in-memory (no network). One school per education
 * row; the section already supports multiple rows.
 *
 * Props:
 *   value       committed display name (the row's `school`)
 *   schoolSlug  current structured slug (null = free-text / custom)
 *   catalog     [{ name, slug }] — from getSchools
 *   onChange    ({ school, schoolSlug }) => void
 *   placeholder
 */
export function SchoolCombobox({
  value = "",
  schoolSlug = null,
  catalog = [],
  onChange,
  placeholder = "Start typing your school…",
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);

  // Reflect external value changes (e.g. parent reorders / removes rows).
  useEffect(() => { setQuery(value); }, [value]);

  // Close on outside click.
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Suggestions appear as you type (like the suburb picker). When the box already
  // shows a committed selection (query === value), don't re-open the list.
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (q.length < 1) return [];
    return catalog.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [q, catalog]);

  const choose = (school) => {
    setQuery(school.name);
    setOpen(false);
    onChange?.({ school: school.name, schoolSlug: school.slug });
  };

  const onInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    setActive(-1);
    setOpen(true);
    // Typing is free text until a suggestion is picked — drop any structured link.
    onChange?.({ school: v, schoolSlug: null });
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(results[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const showDropdown = open && query.trim() !== value.trim() && results.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 h-9 px-3" style={{ border: "1px solid var(--paper-line)", borderRadius: 8, background: "var(--paper-card)" }}>
        <input
          value={query}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-[13.5px] text-slate-900 placeholder:text-slate-400"
        />
        {!!schoolSlug && (
          <Icon name="check" size={14} className="text-emerald-600 shrink-0" title="Listed school" />
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full mt-2 z-50 bg-[color:var(--paper-card)] max-h-[260px] overflow-y-auto"
          style={{ border: "1px solid var(--paper-line)", borderRadius: 12, boxShadow: "0 10px 24px -8px rgba(15,23,42,0.12)" }}
        >
          {results.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); choose(s); }}
              onMouseEnter={() => setActive(i)}
              className="w-full text-left px-3 py-2 text-[13.5px] text-slate-900"
              style={{ background: i === active ? "var(--desk)" : "transparent" }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
