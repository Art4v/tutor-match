import { Icon } from "@/components/Icon";

/**
 * Static timeline — same 44px icon rail as ExperienceTimeline, with a level
 * pill ("University" / "High School") beside each school.
 */
export function EducationTimeline({ education }) {
  if (!education?.length) return null;
  const last = education.length - 1;

  return (
    <ul>
      {education.map((e, i) => (
        <li key={i} className="flex gap-4 items-start">
          <div className="flex flex-col items-center" style={{ width: 44 }}>
            <div
              className="w-11 h-11 inline-flex items-center justify-center shrink-0"
              style={{ background: "var(--pill)", border: "1px solid var(--line)", borderRadius: 11, color: "var(--sage)" }}
            >
              <Icon name="graduation" size={17} />
            </div>
            {i < last && (
              <div style={{ width: 2, flex: 1, background: "var(--line-soft)", marginTop: 4, minHeight: 16 }} />
            )}
          </div>

          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[16.5px] font-medium" style={{ color: "var(--ink-graphite-deep)" }}>{e.school}</h3>
              <span
                className="text-[11.5px] font-medium"
                style={{ background: "var(--pill)", border: "1px solid var(--chip-line)", borderRadius: 999, color: "var(--pill-ink)", padding: "3px 9px" }}
              >
                {e.level === "university" ? "University" : "High School"}
              </span>
            </div>
            <div className="text-[14px] mt-0.5" style={{ color: "var(--sage)" }}>{e.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
