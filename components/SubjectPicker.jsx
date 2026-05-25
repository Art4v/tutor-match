"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Chip } from "@/components/ui";
import { groupByExam, subjectLabel } from "@/lib/subjects";

/**
 * Exam-first subject selector, shared by /settings, /browse and the home hero.
 * The catalog (from getSubjects) is grouped by exam; the user picks an exam,
 * then searches/ticks subjects within it. Everything is keyed by slug — the
 * canonical, exam-scoped identity.
 *
 * Props:
 *   catalog     [{ name, slug, exam, examName, ... }]  (sorted)
 *   value       multi: string[] of slugs · single: string|null slug
 *   onChange    multi: (nextSlugs) => void
 *               single: (slug|null, subject|null) => void
 *   mode        'multi' (default) | 'single'
 *   variant     'box' (default — bordered field) | 'bar' (hero search segment)
 *   placeholder trigger placeholder text
 *   label       'bar' variant only — the uppercase field label (e.g. "Subject")
 */
export function SubjectPicker({
  catalog = [],
  value,
  onChange,
  mode = "multi",
  variant = "box",
  placeholder = "Add subjects",
  label = "Subject",
}) {
  const groups = useMemo(() => groupByExam(catalog), [catalog]);
  const bySlug = useMemo(() => {
    const m = new Map();
    for (const s of catalog) m.set(s.slug, s);
    return m;
  }, [catalog]);

  const [open, setOpen] = useState(false);
  const [activeExam, setActiveExam] = useState(null);
  const [search, setSearch] = useState("");
  const wrapRef = useRef(null);

  const selected = mode === "multi"
    ? (Array.isArray(value) ? value : [])
    : (value ? [value] : []);

  // Pick a sensible exam when the panel opens.
  useEffect(() => {
    if (!open || activeExam) return;
    const fromValue = mode === "single" && value ? bySlug.get(value)?.exam : null;
    setActiveExam(fromValue ?? groups[0]?.code ?? null);
  }, [open, activeExam, mode, value, bySlug, groups]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const activeGroup = groups.find((g) => g.code === activeExam) ?? groups[0] ?? null;
  const filtered = (activeGroup?.subjects ?? []).filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

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

  const examLabel = (g) => (g.code === "TEST" ? "Tests" : g.code);
  const singleLabel = mode === "single" && value ? subjectLabel(bySlug.get(value) ?? { name: value }) : "";

  // ---- triggers ----
  const trigger =
    variant === "bar" ? (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Icon name="search" size={16} className="text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</div>
          <div className={"text-[14px] mt-0.5 truncate " + (singleLabel ? "text-slate-900" : "text-slate-400")}>
            {singleLabel || placeholder}
          </div>
        </div>
        <Icon name="chevron-down" size={14} className="text-slate-400 shrink-0" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 h-9 px-3 text-left"
        style={{ border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff" }}
      >
        <Icon name="search" size={14} className="text-slate-400 shrink-0" />
        <span className={"flex-1 text-[13.5px] truncate " + (selected.length ? "text-slate-900" : "text-slate-400")}>
          {mode === "single"
            ? (singleLabel || placeholder)
            : (selected.length ? `${selected.length} selected` : placeholder)}
        </span>
        <Icon name="chevron-down" size={14} className="text-slate-400 shrink-0" />
      </button>
    );

  const panelWidth = variant === "bar" ? { width: 320, maxWidth: "calc(100vw - 24px)" } : { left: 0, right: 0 };

  return (
    <div
      ref={wrapRef}
      className={variant === "bar" ? "relative border-r last:border-r-0" : "relative"}
      style={variant === "bar" ? { borderColor: "#E5E7EB" } : undefined}
    >
      {trigger}

      {/* Selected chips (multi only) live under the field. */}
      {mode === "multi" && variant === "box" && selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((slug) => (
            <Chip key={slug} tone="grey" onRemove={() => remove(slug)}>
              {subjectLabel(bySlug.get(slug) ?? { name: slug })}
            </Chip>
          ))}
        </div>
      )}

      {open && groups.length > 0 && (
        <div
          className="absolute top-full mt-2 z-50 bg-white overflow-hidden"
          style={{
            ...panelWidth,
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            boxShadow: "0 10px 24px -8px rgba(15,23,42,0.18)",
          }}
        >
          {/* Exam selector */}
          <div className="flex flex-wrap gap-1.5 p-2.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
            {groups.map((g) => {
              const active = g.code === activeExam;
              return (
                <button
                  key={g.code}
                  type="button"
                  title={g.name}
                  onClick={() => { setActiveExam(g.code); setSearch(""); }}
                  className="px-2.5 py-1 text-[12px] font-medium rounded-full transition-colors"
                  style={{
                    background: active ? "#1F2937" : "#F3F4F6",
                    color: active ? "#fff" : "#374151",
                    border: "1px solid " + (active ? "#1F2937" : "transparent"),
                  }}
                >
                  {examLabel(g)}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="p-2.5" style={{ borderBottom: "1px solid #F1F5F9" }}>
            <div className="flex items-center gap-2 h-8 px-2.5" style={{ background: "#FAFAFA", borderRadius: 8 }}>
              <Icon name="search" size={13} className="text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${activeGroup ? examLabel(activeGroup) : ""} subjects`}
                className="w-full bg-transparent outline-none text-[13px] text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Subject list */}
          <div className="max-h-[240px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[13px] text-slate-400">No matching subjects</div>
            ) : (
              filtered.map((s) => {
                const sel = isSelected(s.slug);
                return (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => toggle(s.slug)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[13.5px] text-slate-700 hover:bg-slate-100"
                    style={{ background: sel && mode === "single" ? "#F3F4F6" : "transparent" }}
                  >
                    {mode === "multi" && (
                      <span
                        className="inline-flex items-center justify-center shrink-0"
                        style={{
                          width: 16, height: 16, borderRadius: 4,
                          background: sel ? "#1F2937" : "#fff",
                          border: "1px solid " + (sel ? "#1F2937" : "#CBD5E1"),
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
