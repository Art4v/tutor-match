import { Icon } from "@/components/Icon";

/**
 * Static timeline — a 44px icon rail with a connector line running between
 * entries, and the role detail alongside.
 */
export function ExperienceTimeline({ experience }) {
  if (!experience?.length) return null;
  const last = experience.length - 1;

  return (
    <ol>
      {experience.map((e, i) => (
        <li key={i} className="flex gap-4">
          <div className="flex flex-col items-center" style={{ width: 44 }}>
            <div
              className="w-11 h-11 inline-flex items-center justify-center shrink-0"
              style={{ background: "var(--pill)", border: "1px solid var(--line)", borderRadius: 11, color: "var(--sage)" }}
            >
              <Icon name="briefcase" size={17} />
            </div>
            {i < last && (
              <div style={{ width: 2, flex: 1, background: "var(--line-soft)", marginTop: 4 }} />
            )}
          </div>

          <div className="flex-1 pb-4">
            <h3 className="text-[16.5px] font-medium" style={{ color: "var(--ink-graphite-deep)" }}>{e.role}</h3>
            <div className="text-[14.5px]" style={{ color: "var(--ink-muted)" }}>{e.org}</div>
            <div className="text-[13px] mt-0.5" style={{ color: "var(--sage)" }}>{e.period}</div>
            <div className="text-[14.5px] mt-2 leading-[1.55]" style={{ color: "var(--ink-muted)" }}>{e.note}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
