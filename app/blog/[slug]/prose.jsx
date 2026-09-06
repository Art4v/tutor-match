// Body chrome for article bodies, so a callout or a table is a theme decision
// made once rather than markup repeated per article. Moved here from
// content/blog/prose.jsx when articles became rows (0061); the components are
// unchanged, only their caller is. Server components: no state, no handlers.
//
// These stay dumb and presentational. ArticleBody.jsx turns jsonb into the
// children/cells passed in here, which is what keeps the styling in one place
// and the whitelist in the other.

/** The one caption treatment, shared by Table and Figure. */
function Caption({ children }) {
  if (!children) return null;
  return (
    <figcaption className="text-[12.5px] mt-2" style={{ color: "var(--sage)" }}>
      {children}
    </figcaption>
  );
}

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
              {head.map((h, i) => (
                <th
                  key={i}
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
      <Caption>{caption}</Caption>
    </figure>
  );
}

/**
 * A full-width body image. No width or alignment options by design: one
 * treatment is a theme decision made once, exactly like Callout and Table.
 *
 * width/height are the image's INTRINSIC pixel size, recovered from its
 * filename by lib/markdown.js, and the aspectRatio repeats them as a style so
 * the browser reserves the box before the bytes arrive. Without them a long
 * article visibly reflows as each image lands.
 *
 * alt="" rather than a missing attribute when blank, so a decorative image is
 * announced as decorative instead of having its filename read out.
 */
export function Figure({ src, alt, width, height, caption }) {
  return (
    <figure className="my-6">
      <img
        src={src}
        alt={alt || ""}
        width={width || undefined}
        height={height || undefined}
        loading="lazy"
        decoding="async"
        className="block w-full h-auto"
        style={{
          border: "1px solid var(--paper-line)",
          borderRadius: "var(--radius-card)",
          background: "var(--desk)",
          aspectRatio: width && height ? `${width} / ${height}` : undefined,
        }}
      />
      <Caption>{caption}</Caption>
    </figure>
  );
}
