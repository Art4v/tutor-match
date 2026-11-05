"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * School field for the education editor. A searchable dropdown: clicking the
 * field opens the full list of seeded schools, typing filters it, picking one
 * records a structured slug. Anything not in the list is kept as free text
 * (schoolSlug = null) — the display `school` name is always set either way, so
 * profile/card rendering is unchanged. One school per education row.
 *
 * Matches the seeded catalog in-memory (no network).
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
  placeholder = "Search for your school…",
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
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

  // Browse the full list when the field is empty, or when it still shows an
  // unchanged listed selection (so clicking a filled field reveals the whole
  // dropdown to re-pick, like a select). As soon as the tutor edits the text the
  // structured link clears (onInput → schoolSlug null), so we filter by query.
  // NB: `value` mirrors the query live as they type, so it can't be the signal.
  const q = query.trim().toLowerCase();
  const selectedName = schoolSlug
    ? catalog.find((s) => s.slug === schoolSlug)?.name ?? ""
    : "";
  const browsing = q.length === 0 || (!!schoolSlug && query.trim() === selectedName);
  const results = useMemo(() => {
    if (browsing) return catalog;
    return catalog.filter((s) => s.name.toLowerCase().includes(q));
  }, [q, browsing, catalog]);

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
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && active >= 0 && results[active]) { e.preventDefault(); choose(results[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  // No-match hint only when the tutor has actually typed a custom name.
  const noMatchHint = !browsing && results.length === 0 && q.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      {/* DESIGN.md input: 44px, white, 1px input border, 4px radius; the accent
          border marks focus. */}
      <div
        className={
          "flex items-stretch h-11 bg-surface border rounded " + (focus ? "border-accent" : "border-input")
        }
        style={{ transition: "border-color 120ms ease-out" }}
      >
        <input
          value={query}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onFocus={() => { setFocus(true); setOpen(true); }}
          onBlur={() => setFocus(false)}
          onMouseDown={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent outline-none px-3 text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder"
        />
        {!!schoolSlug && (
          <span className="flex items-center pr-3 shrink-0 text-success" title="Listed school">
            <Icon name="check" size={16} />
          </span>
        )}
      </div>

      {open && (results.length > 0 || noMatchHint) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-rule rounded shadow-float max-h-[264px] overflow-y-auto overscroll-contain py-1">
          {results.map((s, i) => {
            const sel = s.slug === schoolSlug;
            return (
              <button
                key={s.slug}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(s); }}
                onMouseEnter={() => setActive(i)}
                className={
                  "w-full flex items-center gap-2 min-h-11 text-left px-3 text-[14px] leading-5 text-[color:var(--text)] " +
                  (i === active ? "bg-surface-2" : "bg-surface") + (sel ? " font-semibold" : "")
                }
              >
                <span className="flex-1 truncate">{s.name}</span>
                {sel && <Icon name="check" size={16} className="text-success shrink-0" />}
              </button>
            );
          })}
          {noMatchHint && (
            <div className="px-3 py-3 text-[14px] leading-5 text-[color:var(--text-2)]">
              Not listed. We&rsquo;ll save &ldquo;{query.trim()}&rdquo; as your school.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
