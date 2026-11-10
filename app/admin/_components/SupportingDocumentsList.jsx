import { Icon } from "@/components/Icon";

/** A tutor's private supporting documents (0079). Links last 1 hour; reload for fresh ones. */
export function SupportingDocumentsList({ docs }) {
  if (docs.length === 0) {
    return <p className="text-[13.5px] text-slate-500">Nothing was attached.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-2 text-[13.5px]">
          <Icon name="file-text" size={14} className="text-slate-400 shrink-0" />
          {d.url ? (
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="truncate" style={{ color: "var(--accent)" }}>
              {d.fileName}
            </a>
          ) : (
            <span className="truncate text-slate-700">{d.fileName} (unavailable)</span>
          )}
        </li>
      ))}
    </ul>
  );
}
