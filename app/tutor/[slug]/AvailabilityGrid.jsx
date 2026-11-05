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
    return <p className="text-[14px] leading-5 text-[color:var(--text-2)]">No availability set yet.</p>;
  }

  // Inclusive [firstRow, lastRow], keeping the absolute index for hour labels.
  const rows = [];
  for (let hi = firstRow; hi <= lastRow; hi++) rows.push({ hi, label: hours[hi] });

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px]" style={{ borderCollapse: "separate", borderSpacing: 4, tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: 56 }}><span className="sr-only">Time</span></th>
              {days.map((d) => (
                <th key={d} className="text-center text-[12px] leading-4 font-semibold text-[color:var(--text-2)]">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ hi, label }) => (
              <tr key={hi}>
                <td className="pr-1 text-right text-[12px] leading-4 tabular-nums text-[color:var(--muted)]">{label}</td>
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

      <div className="flex flex-wrap items-center gap-4 mt-3 text-[12px] leading-4 text-[color:var(--text-2)]">
        <span className="flex items-center gap-2">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-accent text-white">
            <Icon name="check" size={12} strokeWidth={2.5} />
          </span>
          Free
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded bg-surface-2" />
          Unavailable
        </span>
      </div>
    </div>
  );
}

// Free is the accent with a check (colour never carries meaning alone);
// booked and unavailable are the neutral tint, booked with a cross.
function Cell({ v }) {
  const label = v === 1 ? "Free" : v === 2 ? "Booked" : "Unavailable";
  return (
    <div
      className={`flex h-8 items-center justify-center rounded ${
        v === 1 ? "bg-accent text-white" : "bg-surface-2 text-[color:var(--muted)]"
      }`}
      title={label}
    >
      {v === 1 && <Icon name="check" size={12} strokeWidth={2.5} />}
      {v === 2 && <Icon name="x" size={12} strokeWidth={2.5} />}
      <span className="sr-only">{label}</span>
    </div>
  );
}
