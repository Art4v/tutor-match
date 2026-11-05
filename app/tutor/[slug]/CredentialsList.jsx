/**
 * Credentials as a ruled list: the type ("ATAR", "Degree", …) on the left in
 * secondary text, the value on the right. No tiles, no icons (DESIGN.md §6).
 */
export function CredentialsList({ tiles }) {
  if (!tiles?.length) return null;
  return (
    <dl className="border-t border-rule">
      {tiles.map((c) => (
        <div key={c.key} className="flex flex-col gap-1 border-b border-rule py-3 sm:flex-row sm:gap-4">
          <dt className="shrink-0 text-[14px] leading-6 text-[color:var(--text-2)] sm:w-[128px]">{c.caption}</dt>
          <dd
            className={`min-w-0 break-words text-[16px] leading-6 font-semibold text-[color:var(--text)]${c.kind === "stat" ? " tabular-nums" : ""}`}
          >
            {c.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
