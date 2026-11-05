"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Chip } from "@/components/ui";
import { CheckBox } from "@/components/SubjectPicker";

/**
 * Searchable slug-keyed selector, matching the `?school=` / `?state=` URL
 * contracts. Flat (no exam grouping). Two modes / two looks:
 *   mode="multi" variant="box"  — /browse sidebar filter (checkbox list + chips)
 *   mode="single" variant="bar" — home hero search segment (one value)
 *
 * The per-list copy is hard-coded in KINDS below rather than passed in, so call
 * sites stay short and the two pickers can't drift apart visually.
 *
 * Props:
 *   kind        'school' (default) | 'state' — icon + copy + whether it searches
 *   catalog     [{ name, slug }]  (schools from getSchools; states from AU_STATES)
 *   value       multi: string[] of slugs · single: string|null slug
 *   onChange    multi: (nextSlugs) => void
 *               single: (slug|null, item|null) => void
 *   mode        'multi' (default) | 'single'
 *   variant     'box' (default) | 'bar'
 *   placeholder trigger placeholder text
 *   label       'bar' variant only: the small field label (e.g. "State")
 */
const KINDS = {
  school: {
    icon: "graduation",
    search: "Search schools",
    empty: "No matching schools",
    searchable: true,
  },
  state: {
    icon: "map-pin",
    search: null,
    empty: "No matching states",
    // Eight fixed entries — a search field would be noise.
    searchable: false,
  },
};

export function CatalogPicker({
  kind = "school",
  catalog = [],
  value,
  onChange,
  mode = "multi",
  variant = "box",
  placeholder = "Add schools",
  label = "School",
}) {
  const k = KINDS[kind] ?? KINDS.school;

  const bySlug = useMemo(() => {
    const m = new Map();
    for (const s of catalog) m.set(s.slug, s);
    return m;
  }, [catalog]);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef(null);

  const selected = mode === "multi"
    ? (Array.isArray(value) ? value : [])
    : (value ? [value] : []);

  const nameOf = (slug) => bySlug.get(slug)?.name ?? slug;

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = k.searchable ? search.trim().toLowerCase() : "";
  const filtered = q
    ? catalog.filter((s) => s.name.toLowerCase().includes(q))
    : catalog;

  const isSelected = (slug) => selected.includes(slug);

  const toggle = (slug) => {
    if (mode === "single") {
      const next = value === slug ? null : slug;
      onChange?.(next, next ? bySlug.get(next) ?? null : null);
      setOpen(false);
      return;
    }
    onChange?.(isSelected(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);
  };
  const remove = (slug) => {
    if (mode === "single") onChange?.(null, null);
    else onChange?.(selected.filter((s) => s !== slug));
  };

  const singleLabel = mode === "single" && value ? nameOf(value) : "";

  // ---- triggers ----
  // Same field styles as SubjectPicker (DESIGN.md inputs), so the two pickers
  // read as one control family.
  const trigger =
    variant === "bar" ? (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 h-12 text-left rounded hover:bg-surface-2"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[12px] leading-4 font-semibold text-[color:var(--text-2)]">{label}</div>
          <div className={"text-[14px] leading-5 truncate " + (singleLabel ? "text-[color:var(--text)]" : "text-placeholder")}>
            {singleLabel || placeholder}
          </div>
        </div>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={16} className="text-[color:var(--text-2)] shrink-0 hidden sm:block" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={"w-full flex items-center gap-2 h-11 px-3 text-left bg-surface border rounded " + (open ? "border-accent" : "border-input")}
      >
        <span className={"flex-1 min-w-0 text-[14px] leading-5 truncate " + (selected.length ? "text-[color:var(--text)]" : "text-placeholder")}>
          {selected.length ? `${selected.length} selected` : placeholder}
        </span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={16} className="text-[color:var(--text-2)] shrink-0" />
      </button>
    );

  const panelWidth = variant === "bar" ? { width: 320, maxWidth: "calc(100vw - 32px)" } : { left: 0, right: 0 };

  return (
    <div
      ref={wrapRef}
      className={variant === "bar" ? "relative border-r border-rule last:border-r-0" : "relative"}
    >
      {trigger}

      {/* Selected chips (multi/box only). */}
      {mode === "multi" && variant === "box" && selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selected.map((slug) => (
            <Chip key={slug} tone="grey" onRemove={() => remove(slug)}>
              {nameOf(slug)}
            </Chip>
          ))}
        </div>
      )}

      {open && (
        <div
          className="absolute top-full mt-1 z-50 bg-surface border border-rule rounded shadow-float overflow-hidden"
          style={panelWidth}
        >
          {/* Search */}
          {k.searchable && (
            <div className="p-2 border-b border-rule">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={k.search}
                aria-label={k.search}
                className="w-full h-11 px-3 bg-surface border border-input rounded outline-none focus:border-accent text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder"
              />
            </div>
          )}

          {/* Options */}
          <div className="max-h-[264px] overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[14px] leading-5 text-[color:var(--text-2)]">{k.empty}</div>
            ) : (
              filtered.map((s) => {
                const sel = isSelected(s.slug);
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => toggle(s.slug)}
                    aria-pressed={mode === "multi" ? sel : undefined}
                    className={
                      "w-full flex items-center gap-3 min-h-11 px-3 text-left text-[14px] leading-5 text-[color:var(--text)] hover:bg-surface-2 " +
                      (sel && mode === "single" ? "bg-surface-2 font-semibold" : "")
                    }
                  >
                    {mode === "multi" && <CheckBox checked={sel} />}
                    <span className="truncate">{s.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
