import { Icon } from "@/components/Icon";

/**
 * Weekly availability grid.
 *
 * The editor grid spans the full 24h, one row per hour (24 rows). On the
 * public profile we clip to the tutor's marked range — the first through last
 * row that has any Free/Booked cell — so an early-morning-to-evening tutor isn't
 * shown a wall of empty midnight rows.
 */
export function AvailabilityGrid({ availability }) {
  const { hours, days, grid } = availability;

  // Find the marked range so we only render rows the tutor actually uses.
  let firstRow = -1;
  let lastRow = -1;
  for (let hi = 0; hi < hours.length; hi++) {
    const marked = (grid[hi] ?? []).some((v) => v !== 0);
    if (marked) {
      if (firstRow === -1) firstRow = hi;
      lastRow = hi;
    }
  }

  if (firstRow === -1) {
    return <p className="text-[13px] text-slate-400">No availability set yet.</p>;
  }

  // Inclusive [firstRow, lastRow], keeping the absolute index for hour labels.
  const rows = [];
  for (let hi = firstRow; hi <= lastRow; hi++) rows.push({ hi, label: hours[hi] });

  return (
    <div>
      <div className="overflow-x-auto">
        <table
          className="w-full"
          style={{ borderCollapse: "separate", borderSpacing: 8, tableLayout: "fixed" }}
        >
          <thead>
            <tr>
              <th style={{ width: 54 }}></th>
              {days.map((d) => (
                <th key={d} className="text-center text-[13px] font-medium" style={{ color: "var(--ink-muted)" }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ hi, label }) => (
              <tr key={hi}>
                <td className="text-[12.5px] tabular-nums text-right" style={{ color: "var(--sage)" }}>{label}</td>
                {days.map((_, di) => (
                  <td key={di}>
                    <Cell v={grid[hi]?.[di] ?? 0} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 mt-3 text-[13px] flex-wrap" style={{ color: "var(--sage)" }}>
        <LegendSwatch
          label="Free"
          bg="var(--accent-soft)"
          border="var(--accent-line)"
          icon="check"
          iconColor="var(--accent)"
        />
        <LegendSwatch label="Unavailable" bg="var(--bg-soft)" />
      </div>
    </div>
  );
}

function Cell({ v }) {
  const tone =
    v === 1
      ? { background: "var(--accent-soft)", color: "var(--accent)" }
      : v === 2
      ? { background: "var(--desk)", color: "var(--accent-hover)" }
      : { background: "var(--bg-soft)", color: "var(--line-strong)" };

  return (
    <div
      className="flex items-center justify-center font-medium"
      style={{ height: 36, borderRadius: 8, ...tone }}
      title={v === 1 ? "Free" : v === 2 ? "Booked" : "—"}
    >
      {v === 1 && <Icon name="check" size={13} strokeWidth={2.5} />}
      {v === 2 && <Icon name="x" size={12} strokeWidth={2.5} />}
    </div>
  );
}

function LegendSwatch({ label, bg, border, icon, iconColor }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center rounded"
        style={{
          width: 18,
          height: 18,
          background: bg,
          border: border ? `1px solid ${border}` : "1px solid transparent",
          color: iconColor,
        }}
      >
        {icon && <Icon name={icon} size={11} strokeWidth={2.5} />}
      </span>
      {label}
    </span>
  );
}
