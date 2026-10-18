import { Icon } from "@/components/Icon";
import { AvailabilityGrid } from "@/app/tutor/[slug]/AvailabilityGrid";
import { editorToDisplay } from "@/lib/tutorShape";
import { resolveImage } from "@/lib/profileRevision";

// Field-by-field view of a diffProfiles() result for the admin review page.
// Text shows before -> after, photos side by side (staged files through signed
// URLs), subjects and documents as added/removed chips, availability as both
// grids. Server-rendered; nothing here is interactive.
export function RevisionDiff({ diff, signed = {} }) {
  if (!diff.length) {
    return <p className="text-[13.5px] text-slate-500">The draft matches the live profile.</p>;
  }
  return (
    <ul className="space-y-3">
      {diff.map((d) => (
        <li key={d.key} style={{ background: "var(--bg-soft)", border: "1px solid var(--paper-line)", borderRadius: 12, padding: 14 }}>
          <div className="text-[12px] font-medium uppercase tracking-wider text-slate-500 mb-2">{d.label}</div>
          <Entry d={d} signed={signed} />
        </li>
      ))}
    </ul>
  );
}

function Entry({ d, signed }) {
  if (d.kind === "text") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13.5px]">
        <Side tone="before">{d.before || <Empty />}</Side>
        <Side tone="after">{d.after || <Empty />}</Side>
      </div>
    );
  }
  if (d.kind === "list") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13.5px]">
        <Side tone="before">{d.before.length ? <Lines items={d.before} /> : <Empty />}</Side>
        <Side tone="after">{d.after.length ? <Lines items={d.after} /> : <Empty />}</Side>
      </div>
    );
  }
  if (d.kind === "image") {
    const wide = d.key === "bannerImg";
    return (
      <div className="grid grid-cols-2 gap-2">
        <Side tone="before"><Picture src={d.before} wide={wide} /></Side>
        <Side tone="after"><Picture src={resolveImage(d.after, signed)} wide={wide} /></Side>
      </div>
    );
  }
  if (d.kind === "subjects" || d.kind === "documents") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {d.added.map((x, i) => <Chip key={`a${i}`} sign="+">{x}</Chip>)}
        {d.removed.map((x, i) => <Chip key={`r${i}`} sign="-">{x}</Chip>)}
        {(d.renamed ?? []).map((r, i) => (
          <Chip key={`n${i}`} sign="~">{r.before} to {r.after}</Chip>
        ))}
        {d.reordered && <span className="text-[13px] text-slate-500">Same subjects, new order.</span>}
      </div>
    );
  }
  if (d.kind === "availability") {
    const before = editorToDisplay({ availability: d.before }).availability;
    const after = editorToDisplay({ availability: d.after }).availability;
    return (
      <div className="grid grid-cols-1 gap-3">
        <Side tone="before">{before ? <AvailabilityGrid availability={before} /> : <Empty />}</Side>
        <Side tone="after">{after ? <AvailabilityGrid availability={after} /> : <Empty />}</Side>
      </div>
    );
  }
  return null;
}

function Side({ tone, children }) {
  const after = tone === "after";
  return (
    <div style={{ background: "var(--paper-card)", border: `1px solid ${after ? "var(--accent-line)" : "var(--paper-line)"}`, borderRadius: 10, padding: 10 }}>
      <div className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: after ? "var(--accent)" : "var(--sage)" }}>
        {after ? "New" : "Current"}
      </div>
      <div className="text-slate-700 whitespace-pre-wrap break-words">{children}</div>
    </div>
  );
}

function Lines({ items }) {
  return (
    <ul className="space-y-1">
      {items.map((x, i) => <li key={i}>{x}</li>)}
    </ul>
  );
}

function Picture({ src, wide }) {
  if (!src) return <Empty />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="w-full object-cover" style={{ height: wide ? 70 : 120, borderRadius: 8, background: "var(--desk)" }} />
  );
}

function Chip({ sign, children }) {
  const added = sign === "+";
  const removed = sign === "-";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[12.5px]"
      style={{
        borderRadius: 999,
        background: added ? "#ECFDF5" : removed ? "#FEF2F2" : "var(--paper-card)",
        color: added ? "#047857" : removed ? "#B91C1C" : "var(--ink)",
        border: `1px solid ${added ? "#A7F3D0" : removed ? "#FECACA" : "var(--paper-line)"}`,
        textDecoration: removed ? "line-through" : "none",
      }}
    >
      <Icon name={added ? "plus" : removed ? "minus" : "pencil"} size={11} />
      {children}
    </span>
  );
}

function Empty() {
  return <span className="text-slate-400">Empty</span>;
}
