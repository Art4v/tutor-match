// Shared building blocks for article bodies, so the five article modules stay
// prose and don't each re-declare table or callout chrome. Server components:
// no state, no handlers. Colours come from the theme tokens, not new values.

/** A soft accent panel for a definition, a warning, or a "in short" summary. */
export function Callout({ title, children }) {
  return (
    <div
      className="my-6 px-5 py-4"
      style={{
        background: "var(--accent-softer)",
        border: "1px solid var(--accent-line)",
        borderRadius: "var(--radius-card)",
      }}
    >
      {title && (
        <div className="text-[13px] font-medium mb-1.5" style={{ color: "var(--accent)" }}>
          {title}
        </div>
      )}
      <div className="text-[14.5px] leading-[1.65]" style={{ color: "var(--ink-muted)" }}>
        {children}
      </div>
    </div>
  );
}

/**
 * A simple data table. `head` is an array of column labels, `rows` an array of
 * cell arrays. Wrapped in an overflow-x container so a wide table scrolls on a
 * phone instead of stretching the article column.
 */
export function Table({ head, rows, caption }) {
  return (
    <figure className="my-6">
      <div className="overflow-x-auto" style={{ border: "1px solid var(--paper-line)", borderRadius: "var(--radius-card)" }}>
        <table className="w-full text-[14px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--desk)" }}>
              {head.map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5 font-medium whitespace-nowrap"
                  style={{ color: "var(--ink-graphite)", borderBottom: "1px solid var(--paper-line)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-4 py-2.5 align-top"
                    style={{
                      color: "var(--ink-muted)",
                      borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--paper-line)",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && (
        <figcaption className="text-[12.5px] mt-2" style={{ color: "var(--sage)" }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
