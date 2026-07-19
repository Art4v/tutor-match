"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Chip } from "@/components/ui";

/**
 * Searchable school selector keyed by slug, matching the `?school=` URL contract.
 * Flat (no exam grouping). Two modes / two looks:
 *   mode="multi" variant="box"  — /browse sidebar filter (checkbox list + chips)
 *   mode="single" variant="bar" — home hero search segment (one school)
 *
 * Props:
 *   catalog     [{ name, slug }]  (ordered by HSC rank from getSchools)
 *   value       multi: string[] of slugs · single: string|null slug
 *   onChange    multi: (nextSlugs) => void
 *               single: (slug|null, school|null) => void
 *   mode        'multi' (default) | 'single'
 *   variant     'box' (default) | 'bar'
 *   placeholder trigger placeholder text
 *   label       'bar' variant only — the uppercase field label (e.g. "School")
 */
export function SchoolPicker({
  catalog = [],
  value,
  onChange,
  mode = "multi",
  variant = "box",
  placeholder = "Add schools",
  label = "School",
}) {
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

  const q = search.trim().toLowerCase();
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
  const trigger =
    variant === "bar" ? (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-[52px] sm:h-[54px] text-left transition-colors rounded-[10px] hover:bg-[color:var(--accent-softer)]"
      >
        <Icon name="graduation" size={16} className="text-[color:var(--accent)] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-[11px] font-medium text-[color:var(--ink-muted)] uppercase tracking-wider leading-none">{label}</div>
          <div className={"text-[13px] sm:text-[14px] mt-1.5 truncate leading-none " + (singleLabel ? "text-[color:var(--ink)]" : "text-[color:var(--sage)]")}>
            {singleLabel || placeholder}
          </div>
        </div>
        <Icon name="chevron-down" size={14} className="text-[color:var(--sage)] shrink-0 hidden sm:block" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 h-9 px-3 text-left"
        style={{ border: "1px solid var(--paper-line)", borderRadius: 8, background: "var(--paper-card)" }}
      >
        <Icon name="search" size={14} className="text-slate-400 shrink-0" />
        <span className={"flex-1 text-[13.5px] truncate " + (selected.length ? "text-slate-900" : "text-slate-400")}>
          {selected.length ? `${selected.length} selected` : placeholder}
        </span>
        <Icon name="chevron-down" size={14} className="text-slate-400 shrink-0" />
      </button>
    );

  const panelWidth = variant === "bar" ? { width: 320, maxWidth: "calc(100vw - 24px)" } : { left: 0, right: 0 };

  return (
    <div
      ref={wrapRef}
      className={variant === "bar" ? "relative border-r last:border-r-0" : "relative"}
      style={variant === "bar" ? { borderColor: "var(--line-soft)" } : undefined}
    >
      {trigger}

      {/* Selected chips (multi/box only). */}
      {mode === "multi" && variant === "box" && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((slug) => (
            <Chip key={slug} tone="grey" onRemove={() => remove(slug)}>
              {nameOf(slug)}
            </Chip>
          ))}
        </div>
      )}

      {open && (
        <div
          className="absolute top-full mt-2 z-50 bg-[color:var(--paper-card)] overflow-hidden"
          style={{
            ...panelWidth,
            border: "1px solid var(--paper-line)",
            borderRadius: 12,
            boxShadow: "0 10px 24px -8px rgba(0,30,30,0.18)",
          }}
        >
          {/* Search */}
          <div className="p-2.5" style={{ borderBottom: "1px solid var(--desk)" }}>
            <div className="flex items-center gap-2 h-8 px-2.5" style={{ background: "var(--bg-soft)", borderRadius: 8 }}>
              <Icon name="search" size={13} className="text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search schools"
                className="w-full bg-transparent outline-none text-[13px] text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* School list */}
          <div className="max-h-[240px] overflow-y-auto overscroll-contain py-1" data-lenis-prevent>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[13px] text-slate-400">No matching schools</div>
            ) : (
              filtered.map((s) => {
                const sel = isSelected(s.slug);
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => toggle(s.slug)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] text-slate-700 hover:bg-slate-100"
                    style={{ background: sel && mode === "single" ? "var(--desk)" : "transparent" }}
                  >
                    {mode === "multi" && (
                      <span
                        className="inline-flex items-center justify-center shrink-0"
                        style={{
                          width: 16, height: 16, borderRadius: 4,
                          background: sel ? "var(--ink)" : "#fff",
                          border: "1px solid " + (sel ? "var(--ink)" : "var(--line-strong)"),
                        }}
                      >
                        {sel && <Icon name="check" size={11} strokeWidth={3} className="text-white" />}
                      </span>
                    )}
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
