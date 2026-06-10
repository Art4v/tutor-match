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
  const dragIndexRef = useRef(null);
  const [dragging, setDragging] = useState(null); // slug being dragged

  const selected = mode === "multi"
    ? (Array.isArray(value) ? value : [])
    : (value ? [value] : []);

  const labelOf = (slug) => subjectLabel(bySlug.get(slug) ?? { name: slug });

  // Live drag-and-drop reorder of the selected chips (multi/box only). Reorders
  // as the dragged chip passes over its neighbours; the array order is the order
  // shown on the browse card + public profile (persisted as position in 0014).
  const reorder = (toIndex) => {
    const from = dragIndexRef.current;
    if (from === null || from === toIndex) return;
    const next = [...selected];
    const [moved] = next.splice(from, 1);
    next.splice(toIndex, 0, moved);
    dragIndexRef.current = toIndex;
    onChange?.(next);
  };

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
  // When there's a query, search the ENTIRE catalog (across every exam), not
  // just the active exam tab. With no query we fall back to the active tab's
  // subjects so the exam chips still drive browsing.
  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const filtered = searching
    ? catalog.filter((s) => subjectLabel(s).toLowerCase().includes(q))
    : (activeGroup?.subjects ?? []);

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

  const examLabel = (g) => {
    if (g.code === "TEST") return "Tests";
    if (g.code === "GENERAL") return "General";
    return g.code;
  };
  const singleLabel = mode === "single" && value ? subjectLabel(bySlug.get(value) ?? { name: value }) : "";

  // ---- triggers ----
  const trigger =
    variant === "bar" ? (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-[56px] sm:h-[64px] text-left transition-colors hover:bg-[color:var(--accent-softer)]"
      >
        <Icon name="search" size={16} className="text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider leading-none">{label}</div>
          <div className={"text-[13px] sm:text-[14px] mt-1.5 truncate leading-none " + (singleLabel ? "text-slate-900" : "text-slate-400")}>
            {singleLabel || placeholder}
          </div>
        </div>
        <Icon name="chevron-down" size={14} className="text-slate-400 shrink-0 hidden sm:block" />
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
      style={variant === "bar" ? { borderColor: "var(--paper-line)" } : undefined}
    >
      {trigger}

      {/* Selected chips (multi only) live under the field. Drag to reorder —
          the order is what shows on the browse card + public profile. */}
      {mode === "multi" && variant === "box" && selected.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selected.map((slug, i) => (
              <div
                key={slug}
                draggable
                onDragStart={(e) => { dragIndexRef.current = i; e.dataTransfer.effectAllowed = "move"; setDragging(slug); }}
                onDragEnter={() => reorder(i)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={() => { dragIndexRef.current = null; setDragging(null); }}
                className="cursor-grab active:cursor-grabbing"
                style={{ opacity: dragging === slug ? 0.4 : 1, transition: "opacity 120ms ease-out" }}
                title="Drag to reorder"
              >
                <Chip tone="grey" onRemove={() => remove(slug)}>
                  {labelOf(slug)}
                </Chip>
              </div>
            ))}
          </div>
          {selected.length > 1 && (
            <p className="text-[11.5px] text-slate-400 mt-1.5">Drag to reorder — this is how subjects appear on your card and profile.</p>
          )}
        </>
      )}

      {open && groups.length > 0 && (
        <div
          className="absolute top-full mt-2 z-50 bg-[color:var(--paper-card)] overflow-hidden"
          style={{
            ...panelWidth,
            border: "1px solid var(--paper-line)",
            borderRadius: 12,
            boxShadow: "0 10px 24px -8px rgba(15,23,42,0.18)",
          }}
        >
          {/* Search */}
          <div className="p-2.5" style={{ borderBottom: "1px solid var(--desk)" }}>
            <div className="flex items-center gap-2 h-8 px-2.5" style={{ background: "var(--bg-soft)", borderRadius: 8 }}>
              <Icon name="search" size={13} className="text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search all subjects"
                className="w-full bg-transparent outline-none text-[13px] text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Exam selector */}
          <div className="flex flex-wrap gap-1.5 p-2.5" style={{ borderBottom: "1px solid var(--desk)" }}>
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
                    background: active ? "var(--ink)" : "var(--desk)",
                    color: active ? "#fff" : "var(--ink-muted)",
                    border: "1px solid " + (active ? "var(--ink)" : "transparent"),
                  }}
                >
                  {examLabel(g)}
                </button>
              );
            })}
          </div>

          {/* Subject list */}
          <div className="max-h-[240px] overflow-y-auto overscroll-contain py-1" data-lenis-prevent>
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
                    <span className="truncate">{searching ? subjectLabel(s) : s.name}</span>
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
