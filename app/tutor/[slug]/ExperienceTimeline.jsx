/**
 * Experience as a plain list: role, organisation, period, then the note.
 * No icon rail or connector line (DESIGN.md §6).
 */
export function ExperienceTimeline({ experience }) {
  if (!experience?.length) return null;
  return (
    <ol className="space-y-6">
      {experience.map((e, i) => (
        <li key={i}>
          <h3 className="text-[16px] leading-6 font-semibold text-[color:var(--text)] break-words">{e.role}</h3>
          {e.org && <p className="text-[14px] leading-5 text-[color:var(--text)] break-words">{e.org}</p>}
          {e.period && <p className="text-[12px] leading-4 text-[color:var(--muted)] mt-1">{e.period}</p>}
          {e.note && (
            <p className="text-[14px] leading-5 text-[color:var(--text-2)] mt-2 max-w-[680px] break-words">{e.note}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
