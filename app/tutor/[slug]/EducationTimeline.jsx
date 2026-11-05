/**
 * Education as a plain list: school name, then level and detail on one line.
 * No icon rail, no level pill (DESIGN.md §6).
 */
export function EducationTimeline({ education }) {
  if (!education?.length) return null;
  return (
    <ul className="space-y-4">
      {education.map((e, i) => (
        <li key={i}>
          <h3 className="text-[16px] leading-6 font-semibold text-[color:var(--text)] break-words">{e.school}</h3>
          <p className="text-[14px] leading-5 text-[color:var(--text-2)] break-words">
            {[e.level === "university" ? "University" : "High school", e.detail].filter(Boolean).join(", ")}
          </p>
        </li>
      ))}
    </ul>
  );
}
