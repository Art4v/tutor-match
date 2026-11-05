"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Chip } from "@/components/ui";
import { groupByExam, sortSubjectsByCategory, subjectLabel } from "@/lib/subjects";

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
 *   label       'bar' variant only: the small field label (e.g. "Subject")
 */
export function SubjectPicker({
  catalog = [],
  value,
  onChange,
  mode = "multi",
  variant = "box",
  placeholder = "Add subjects",
  label = "Subject",
  onOpenChange,
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
  const panelRef = useRef(null);
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

  // Report open state + live panel height so a host (e.g. the /settings edit
  // modal) can reserve exactly enough space for the open dropdown and shrink
  // back when it closes. Read the callback through a ref so its identity churn
  // doesn't tear down the ResizeObserver each render.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  useEffect(() => {
    const cb = () => onOpenChangeRef.current;
    if (!open) { cb()?.(false, 0); return; }
    const el = panelRef.current;
    if (!el) return;
    const report = () => cb()?.(true, el.offsetHeight);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const activeGroup = groups.find((g) => g.code === activeExam) ?? groups[0] ?? null;
  // When there's a query, search the ENTIRE catalog (across every exam), not
  // just the active exam tab. With no query we fall back to the active tab's
  // subjects so the exam chips still drive browsing.
  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const filtered = searching
    ? sortSubjectsByCategory(catalog.filter((s) => subjectLabel(s).toLowerCase().includes(q)))
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
  // DESIGN.md inputs: 44px, white, 1px input border, 4px radius, 14px text.
  // The 'bar' variant is a segment of the home search bar, so it is borderless
  // and its label is a plain 12px line (no uppercase tracking).
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
          {mode === "single"
            ? (singleLabel || placeholder)
            : (selected.length ? `${selected.length} selected` : placeholder)}
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

      {/* Selected chips (multi only) live under the field. Drag to reorder:
          the order is what shows on the browse row + public profile. */}
      {mode === "multi" && variant === "box" && selected.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 mt-2">
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
            <p className="text-[12px] leading-4 text-muted mt-1">Drag to reorder. This is the order subjects appear on your card and profile.</p>
          )}
        </>
      )}

      {open && groups.length > 0 && (
        <div
          ref={panelRef}
          className="absolute top-full mt-1 z-50 bg-surface border border-rule rounded shadow-float overflow-hidden"
          style={panelWidth}
        >
          {/* Search */}
          <div className="p-2 border-b border-rule">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all subjects"
              aria-label="Search all subjects"
              className="w-full h-11 px-3 bg-surface border border-input rounded outline-none focus:border-accent text-[14px] leading-5 text-[color:var(--text)] placeholder:text-placeholder"
            />
          </div>

          {/* Exam selector: one row of text tabs, scrolling sideways when it
              runs out of room. The active exam is underlined in the accent. */}
          <div className="flex overflow-x-auto border-b border-rule px-1" role="tablist" aria-label="Exam">
            {groups.map((g) => {
              const active = !searching && g.code === activeExam;
              return (
                <button
                  key={g.code}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  title={g.name}
                  onClick={() => { setActiveExam(g.code); setSearch(""); }}
                  className={
                    "shrink-0 h-11 px-2 border-b-2 text-[14px] leading-5 font-semibold whitespace-nowrap " +
                    (active
                      ? "border-accent text-accent"
                      : "border-transparent text-[color:var(--text-2)] hover:text-[color:var(--text)]")
                  }
                  style={{ transition: "color 120ms ease-out, border-color 120ms ease-out" }}
                >
                  {examLabel(g)}
                </button>
              );
            })}
          </div>

          {/* Subject list */}
          <div className="max-h-[264px] overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-[14px] leading-5 text-[color:var(--text-2)]">No matching subjects</div>
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

// The visual checkbox inside an option row (the row itself is the button).
// DESIGN.md: 1px input border, 4px radius; checked uses the accent.
export function CheckBox({ checked }) {
  return (
    <span
      aria-hidden="true"
      className={
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border " +
        (checked ? "bg-accent border-accent text-white" : "bg-surface border-input")
      }
    >
      {checked && <Icon name="check" size={12} strokeWidth={3} />}
    </span>
  );
}
