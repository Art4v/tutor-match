import { AvailabilityGrid } from "@/app/tutor/[slug]/AvailabilityGrid";
import { editorToDisplay } from "@/lib/tutorShape";
import { resolveImage } from "@/lib/profileRevision";

// Field-by-field view of a diffProfiles() result for the admin review page.
// Text shows before -> after, photos side by side (staged files through signed
// URLs), subjects and documents as added/removed chips, availability as both
// grids. Server-rendered; nothing here is interactive. Ruled rows, no boxes
// (DESIGN.md); added / removed items are plain labelled lists.
export function RevisionDiff({ diff, signed = {} }) {
  if (!diff.length) {
    return <p className="text-[14px] leading-5 text-[color:var(--text-2)]">The draft matches the live profile.</p>;
  }
  return (
    <ul className="border-t border-rule">
      {diff.map((d) => (
        <li key={d.key} className="border-b border-rule py-4">
          <div className="mb-2 text-[14px] leading-5 font-semibold text-[color:var(--text)]">{d.label}</div>
          <Entry d={d} signed={signed} />
        </li>
      ))}
    </ul>
  );
}

function Entry({ d, signed }) {
  if (d.kind === "text") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px] leading-5">
        <Side tone="before">{d.before || <Empty />}</Side>
        <Side tone="after">{d.after || <Empty />}</Side>
      </div>
    );
  }
  if (d.kind === "list") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px] leading-5">
        <Side tone="before">{d.before.length ? <Lines items={d.before} /> : <Empty />}</Side>
        <Side tone="after">{d.after.length ? <Lines items={d.after} /> : <Empty />}</Side>
      </div>
    );
  }
  if (d.kind === "image") {
    const wide = d.key === "bannerImg";
    return (
      <div className="grid grid-cols-2 gap-4">
        <Side tone="before"><Picture src={d.before} wide={wide} /></Side>
        <Side tone="after"><Picture src={resolveImage(d.after, signed)} wide={wide} /></Side>
      </div>
    );
  }
  if (d.kind === "subjects" || d.kind === "documents") {
    return (
      <dl className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-4 gap-y-1 text-[14px] leading-5">
        {d.added.length > 0 && <ChangeLine label="Added" items={d.added} />}
        {d.removed.length > 0 && <ChangeLine label="Removed" items={d.removed} />}
        {(d.renamed ?? []).length > 0 && <ChangeLine label="Renamed" items={d.renamed.map((r) => `${r.before} to ${r.after}`)} />}
        {d.reordered && <ChangeLine label="Order" items={["Same subjects, new order."]} />}
      </dl>
    );
  }
  if (d.kind === "availability") {
    const before = editorToDisplay({ availability: d.before }).availability;
    const after = editorToDisplay({ availability: d.after }).availability;
    return (
      <div className="grid grid-cols-1 gap-4">
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
    <div className="min-w-0">
      <div className={`mb-1 text-[12px] leading-4 ${after ? "font-semibold text-[color:var(--text)]" : "text-muted"}`}>
        {after ? "New" : "Current"}
      </div>
      <div className="whitespace-pre-wrap break-words text-[color:var(--text)]">{children}</div>
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
    <img src={src} alt="" className="w-full object-cover rounded bg-surface-2" style={{ height: wide ? 72 : 120 }} />
  );
}

function ChangeLine({ label, items }) {
  return (
    <>
      <dt className="text-[color:var(--text-2)]">{label}</dt>
      <dd className="text-[color:var(--text)] break-words">{items.join(", ")}</dd>
    </>
  );
}

function Empty() {
  return <span className="text-muted">Empty</span>;
}
