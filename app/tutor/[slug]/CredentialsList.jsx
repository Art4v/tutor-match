import { Icon } from "@/components/Icon";

/**
 * Flat credential tiles — a fixed-width type label on the left, the value on
 * the right. Static (no reveal): the profile page renders every card flat.
 */
export function CredentialsList({ tiles }) {
  if (!tiles?.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {tiles.map((c) => (
        <div
          key={c.key}
          className="px-4 py-[11px] flex items-center gap-4"
          style={{ border: "1px solid var(--line-soft)", borderRadius: 12, background: "var(--desk)" }}
        >
          <div className="flex items-center gap-1.5 text-[12px] uppercase tracking-[0.06em] font-medium w-[132px] shrink-0" style={{ color: "var(--sage)" }}>
            <Icon name={c.icon} size={12} /> {c.caption}
          </div>
          <div
            className={`text-[15.5px] font-medium leading-snug${c.kind === "stat" ? " tabular-nums" : ""}`}
            style={{ color: "var(--ink-graphite)" }}
          >
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}
